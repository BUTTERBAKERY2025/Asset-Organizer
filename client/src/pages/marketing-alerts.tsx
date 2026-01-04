import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight, Plus, Bell, AlertTriangle, Info, CheckCircle, Clock, Eye, Check } from "lucide-react";
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

const alertTypeLabels: Record<string, string> = {
  budget_warning: "تحذير الميزانية",
  deadline_reminder: "تذكير بالموعد النهائي",
  campaign_started: "بدء الحملة",
  campaign_ended: "انتهاء الحملة",
  performance_alert: "تنبيه الأداء",
  task_overdue: "مهمة متأخرة",
  goal_achieved: "تم تحقيق الهدف",
  general: "عام",
};

const priorityLabels: Record<string, string> = {
  low: "منخفض",
  medium: "متوسط",
  high: "عالي",
  urgent: "عاجل",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  medium: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

const priorityIcons: Record<string, React.ReactNode> = {
  low: <Info className="h-5 w-5 text-gray-500" />,
  medium: <Bell className="h-5 w-5 text-blue-500" />,
  high: <AlertTriangle className="h-5 w-5 text-orange-500" />,
  urgent: <AlertTriangle className="h-5 w-5 text-red-500" />,
};

export default function MarketingAlertsPage() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
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
    queryKey: ["/api/marketing/alerts", filterPriority, showUnreadOnly],
    queryFn: async () => {
      let url = "/api/marketing/alerts";
      const params = new URLSearchParams();
      if (filterPriority) params.append("priority", filterPriority);
      if (showUnreadOnly) params.append("isRead", "false");
      if (params.toString()) url += `?${params.toString()}`;
      
      const res = await fetch(url);
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

  const unreadCount = alerts.filter(a => !a.isRead).length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-rose-100 p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/marketing">
              <Button variant="outline" size="sm" className="gap-2" data-testid="button-back">
                <ArrowRight className="h-4 w-4" />
                العودة للتسويق
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2" data-testid="text-page-title">
                التنبيهات
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-sm px-2 py-1 rounded-full">
                    {unreadCount.toLocaleString('en-US')}
                  </span>
                )}
              </h1>
              <p className="text-gray-600">إدارة تنبيهات وإشعارات التسويق</p>
            </div>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-pink-500 hover:bg-pink-600 gap-2" data-testid="button-add-alert">
                <Plus className="h-4 w-4" />
                إنشاء تنبيه
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>إنشاء تنبيه جديد</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>العنوان</Label>
                  <Input
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
                    <SelectTrigger data-testid="select-alert-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(alertTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
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
                    <SelectTrigger data-testid="select-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(priorityLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>الرسالة</Label>
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
                    type="datetime-local"
                    value={formData.expiresAt}
                    onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                    data-testid="input-expires-at"
                  />
                </div>
                <Button
                  onClick={() => createAlertMutation.mutate(formData)}
                  disabled={!formData.title || !formData.message || createAlertMutation.isPending}
                  className="w-full bg-pink-500 hover:bg-pink-600"
                  data-testid="button-submit-alert"
                >
                  {createAlertMutation.isPending ? "جاري الإنشاء..." : "إنشاء التنبيه"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex gap-4 mb-6">
          <Select
            value={filterPriority || "all"}
            onValueChange={(value) => setFilterPriority(value === "all" ? null : value)}
          >
            <SelectTrigger className="w-48 bg-white" data-testid="select-filter-priority">
              <SelectValue placeholder="جميع الأولويات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأولويات</SelectItem>
              {Object.entries(priorityLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showUnreadOnly ? "default" : "outline"}
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
            className={showUnreadOnly ? "bg-pink-500 hover:bg-pink-600" : ""}
            data-testid="button-filter-unread"
          >
            غير المقروءة فقط
          </Button>
        </div>

        <div className="space-y-4">
          {alerts.map((alert) => (
            <Card 
              key={alert.id} 
              className={`hover:shadow-md transition-shadow ${!alert.isRead ? 'border-r-4 border-r-pink-500' : ''}`}
              data-testid={`card-alert-${alert.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  <div className="mt-1">
                    {priorityIcons[alert.priority]}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={`font-semibold ${!alert.isRead ? 'text-gray-900' : 'text-gray-600'}`}>
                        {alert.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-1 rounded ${priorityColors[alert.priority]}`}>
                          {priorityLabels[alert.priority]}
                        </span>
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded">
                          {alertTypeLabels[alert.alertType]}
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{alert.message}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Clock className="h-3 w-3" />
                        {new Date(alert.createdAt).toLocaleString('en-US')}
                      </div>
                      <div className="flex gap-2">
                        {!alert.isRead && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => markAsReadMutation.mutate(alert.id)}
                            className="text-gray-500 hover:text-gray-700"
                            data-testid={`button-mark-read-${alert.id}`}
                          >
                            <Eye className="h-4 w-4 ml-1" />
                            قراءة
                          </Button>
                        )}
                        {!alert.isAcknowledged && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => acknowledgeMutation.mutate(alert.id)}
                            className="text-green-500 hover:text-green-700"
                            data-testid={`button-acknowledge-${alert.id}`}
                          >
                            <Check className="h-4 w-4 ml-1" />
                            تأكيد
                          </Button>
                        )}
                        {alert.isAcknowledged && (
                          <span className="text-xs text-green-500 flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            تم التأكيد
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {alerts.length === 0 && (
          <Card className="p-12 text-center">
            <Bell className="h-16 w-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">لا توجد تنبيهات</h3>
            <p className="text-gray-500">ستظهر هنا التنبيهات والإشعارات الخاصة بالتسويق</p>
          </Card>
        )}
      </div>
    </div>
  );
}
