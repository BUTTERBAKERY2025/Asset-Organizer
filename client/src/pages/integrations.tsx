import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Link2, 
  MessageSquare, 
  FileSpreadsheet, 
  Calculator,
  Plus,
  Settings,
  Send,
  Clock,
  CheckCircle,
  XCircle,
  Download,
  Upload,
  RefreshCw,
  Phone
} from "lucide-react";
import { toast } from "sonner";
import type { ExternalIntegration, NotificationQueueItem, DataImportJob, AccountingExport } from "@shared/schema";

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("accounting");

  const { data: integrations = [] } = useQuery<ExternalIntegration[]>({
    queryKey: ["/api/integrations"],
  });

  const { data: notifications = [] } = useQuery<NotificationQueueItem[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: importJobs = [] } = useQuery<DataImportJob[]>({
    queryKey: ["/api/import-jobs"],
  });

  const { data: accountingExports = [] } = useQuery<AccountingExport[]>({
    queryKey: ["/api/accounting-exports"],
  });

  return (
    <div className="container mx-auto p-6 max-w-7xl" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-butter-dark">التكامل مع الأنظمة الخارجية</h1>
          <p className="text-muted-foreground mt-1">ربط النظام مع المحاسبة والإشعارات واستيراد البيانات</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-[600px]">
          <TabsTrigger value="accounting" className="flex items-center gap-2" data-testid="tab-accounting">
            <Calculator className="h-4 w-4" />
            <span className="hidden sm:inline">المحاسبة</span>
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2" data-testid="tab-notifications">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">الإشعارات</span>
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2" data-testid="tab-import">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">الاستيراد</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">الإعدادات</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounting" className="space-y-6">
          <AccountingSection exports={accountingExports} />
        </TabsContent>

        <TabsContent value="notifications" className="space-y-6">
          <NotificationsSection notifications={notifications} />
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <ImportSection jobs={importJobs} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <SettingsSection integrations={integrations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccountingSection({ exports }: { exports: AccountingExport[] }) {
  const queryClient = useQueryClient();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: branches = [] } = useQuery({
    queryKey: ["/api/branches"],
  });

  const inventoryValuationMutation = useMutation({
    mutationFn: async (branchId?: string) => {
      const res = await fetch("/api/accounting-exports/inventory-valuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ branchId: branchId || null }),
      });
      if (!res.ok) throw new Error("فشل في إنشاء تقرير التقييم");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting-exports"] });
      toast.success(`تم إنشاء تقرير تقييم المخزون - القيمة الإجمالية: ${data.data.totalWithVat.toLocaleString()} ريال`);
    },
    onError: () => toast.error("فشل في إنشاء التقرير"),
  });

  const assetMovementsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting-exports/asset-movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ dateFrom: dateFrom || null, dateTo: dateTo || null }),
      });
      if (!res.ok) throw new Error("فشل في إنشاء تقرير التحويلات");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting-exports"] });
      toast.success(`تم إنشاء تقرير حركة الأصول - ${data.data.totalTransfers} تحويل`);
    },
    onError: () => toast.error("فشل في إنشاء التقرير"),
  });

  const projectCostsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting-exports/project-costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("فشل في إنشاء تقرير تكاليف المشاريع");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounting-exports"] });
      toast.success(`تم إنشاء تقرير تكاليف المشاريع - ${data.data.projectCount} مشروع`);
    },
    onError: () => toast.error("فشل في إنشاء التقرير"),
  });

  const exportTypeLabels: Record<string, string> = {
    inventory_valuation: "تقييم المخزون",
    asset_movements: "حركة الأصول",
    project_costs: "تكاليف المشاريع",
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-blue-600" />
              تقييم المخزون
            </CardTitle>
            <CardDescription>تصدير قيمة المخزون مع ضريبة القيمة المضافة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>الفرع (اختياري)</Label>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger data-testid="select-branch">
                  <SelectValue placeholder="جميع الفروع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">جميع الفروع</SelectItem>
                  {(branches as any[]).map((branch: any) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button 
              onClick={() => inventoryValuationMutation.mutate(selectedBranch || undefined)}
              disabled={inventoryValuationMutation.isPending}
              className="w-full"
              data-testid="btn-export-valuation"
            >
              <Download className="h-4 w-4 ml-2" />
              تصدير للمحاسبة
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-green-600" />
              حركة الأصول
            </CardTitle>
            <CardDescription>تقرير تحويلات الأصول بين الفروع</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">من تاريخ</Label>
                <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="input-date-from" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">إلى تاريخ</Label>
                <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="input-date-to" />
              </div>
            </div>
            <Button 
              onClick={() => assetMovementsMutation.mutate()}
              disabled={assetMovementsMutation.isPending}
              className="w-full"
              data-testid="btn-export-movements"
            >
              <Download className="h-4 w-4 ml-2" />
              تصدير للمحاسبة
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              تكاليف المشاريع
            </CardTitle>
            <CardDescription>ملخص ميزانيات ومصروفات المشاريع</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              يشمل جميع المشاريع مع الميزانية المخططة والمصروفات الفعلية ونسبة الإنجاز
            </p>
            <Button 
              onClick={() => projectCostsMutation.mutate()}
              disabled={projectCostsMutation.isPending}
              className="w-full"
              data-testid="btn-export-projects"
            >
              <Download className="h-4 w-4 ml-2" />
              تصدير للمحاسبة
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل التصديرات</CardTitle>
          <CardDescription>التقارير المصدرة للنظام المحاسبي</CardDescription>
        </CardHeader>
        <CardContent>
          {exports.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد تصديرات بعد</p>
          ) : (
            <div className="space-y-2">
              {exports.slice(0, 10).map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`export-row-${exp.id}`}>
                  <div className="flex items-center gap-3">
                    <Badge variant={exp.status === 'synced' ? 'default' : 'secondary'}>
                      {exp.status === 'synced' ? 'تم المزامنة' : 'مكتمل'}
                    </Badge>
                    <span className="font-medium">{exportTypeLabels[exp.exportType] || exp.exportType}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(exp.createdAt).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NotificationsSection({ notifications }: { notifications: NotificationQueueItem[] }) {
  const queryClient = useQueryClient();
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("sms");

  const sendNotificationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          recipientPhone,
          recipientName,
          channel,
          message,
        }),
      });
      if (!res.ok) throw new Error("فشل في إرسال الإشعار");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      toast.success("تم إضافة الإشعار لقائمة الإرسال");
      setRecipientPhone("");
      setRecipientName("");
      setMessage("");
    },
    onError: () => toast.error("فشل في إرسال الإشعار"),
  });

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="h-4 w-4 text-yellow-500" />,
    sent: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
  };

  const statusLabels: Record<string, string> = {
    pending: "في الانتظار",
    sent: "تم الإرسال",
    failed: "فشل",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            إرسال إشعار جديد
          </CardTitle>
          <CardDescription>
            إرسال رسائل SMS أو WhatsApp للموظفين والمسؤولين
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-800">
              <Phone className="h-5 w-5" />
              <span className="font-medium">ملاحظة:</span>
            </div>
            <p className="text-sm text-yellow-700 mt-1">
              لتفعيل إرسال الرسائل، يرجى إعداد حساب Twilio وإضافة مفاتيح API في إعدادات النظام
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input 
                placeholder="+966xxxxxxxxx" 
                value={recipientPhone}
                onChange={(e) => setRecipientPhone(e.target.value)}
                data-testid="input-recipient-phone"
              />
            </div>
            <div className="space-y-2">
              <Label>اسم المستلم</Label>
              <Input 
                placeholder="اسم المستلم"
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                data-testid="input-recipient-name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>قناة الإرسال</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger data-testid="select-channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>نص الرسالة</Label>
            <Textarea 
              placeholder="أدخل نص الرسالة..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              data-testid="input-message"
            />
          </div>

          <Button 
            onClick={() => sendNotificationMutation.mutate()}
            disabled={sendNotificationMutation.isPending || !recipientPhone || !message}
            data-testid="btn-send-notification"
          >
            <Send className="h-4 w-4 ml-2" />
            إرسال الإشعار
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل الإشعارات</CardTitle>
          <CardDescription>جميع الإشعارات المرسلة والمنتظرة</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد إشعارات</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div key={notification.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`notification-row-${notification.id}`}>
                  <div className="flex items-center gap-3">
                    {statusIcons[notification.status]}
                    <div>
                      <p className="font-medium">{notification.recipientName || notification.recipientPhone}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">{notification.message}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <Badge variant="outline">{notification.channel}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {statusLabels[notification.status]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ImportSection({ jobs }: { jobs: DataImportJob[] }) {
  const statusLabels: Record<string, string> = {
    pending: "في الانتظار",
    processing: "جاري المعالجة",
    completed: "مكتمل",
    failed: "فشل",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    processing: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            استيراد البيانات
          </CardTitle>
          <CardDescription>استيراد بيانات من ملفات Excel أو أنظمة خارجية</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div>
                  <h3 className="font-medium">استيراد من Excel</h3>
                  <p className="text-sm text-muted-foreground">ملفات .xlsx أو .xls</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                استخدم صفحة إدارة المخزون لاستيراد البيانات من ملفات Excel
              </p>
            </div>

            <div className="p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer opacity-50">
              <div className="flex items-center gap-3 mb-2">
                <Link2 className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-medium">استيراد من API</h3>
                  <p className="text-sm text-muted-foreground">ربط مع أنظمة ERP</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                قريباً - ربط مباشر مع أنظمة تخطيط الموارد
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل عمليات الاستيراد</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد عمليات استيراد</p>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`import-job-${job.id}`}>
                  <div className="flex items-center gap-3">
                    <Badge className={statusColors[job.status]}>
                      {statusLabels[job.status]}
                    </Badge>
                    <div>
                      <p className="font-medium">{job.fileName || `استيراد ${job.targetModule}`}</p>
                      <p className="text-sm text-muted-foreground">
                        {job.processedRecords}/{job.totalRecords} سجل
                        {(job.failedRecords ?? 0) > 0 && ` (${job.failedRecords} فشل)`}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {new Date(job.createdAt).toLocaleDateString('ar-SA')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SettingsSection({ integrations }: { integrations: ExternalIntegration[] }) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ name: "", type: "accounting" });

  const createIntegrationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(newIntegration),
      });
      if (!res.ok) throw new Error("فشل في إضافة التكامل");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/integrations"] });
      toast.success("تم إضافة التكامل بنجاح");
      setShowAddDialog(false);
      setNewIntegration({ name: "", type: "accounting" });
    },
    onError: () => toast.error("فشل في إضافة التكامل"),
  });

  const typeLabels: Record<string, string> = {
    accounting: "نظام محاسبة",
    messaging: "إرسال رسائل",
    erp: "نظام ERP",
    import: "استيراد بيانات",
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>إعدادات التكامل</CardTitle>
            <CardDescription>إدارة الاتصالات مع الأنظمة الخارجية</CardDescription>
          </div>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button data-testid="btn-add-integration">
                <Plus className="h-4 w-4 ml-2" />
                إضافة تكامل
              </Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>إضافة تكامل جديد</DialogTitle>
                <DialogDescription>إعداد اتصال مع نظام خارجي</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم التكامل</Label>
                  <Input 
                    value={newIntegration.name}
                    onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
                    placeholder="مثال: نظام قيود المحاسبي"
                    data-testid="input-integration-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>نوع التكامل</Label>
                  <Select 
                    value={newIntegration.type} 
                    onValueChange={(v) => setNewIntegration({ ...newIntegration, type: v })}
                  >
                    <SelectTrigger data-testid="select-integration-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accounting">نظام محاسبة</SelectItem>
                      <SelectItem value="messaging">إرسال رسائل</SelectItem>
                      <SelectItem value="erp">نظام ERP</SelectItem>
                      <SelectItem value="import">استيراد بيانات</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowAddDialog(false)}>إلغاء</Button>
                <Button 
                  onClick={() => createIntegrationMutation.mutate()}
                  disabled={!newIntegration.name || createIntegrationMutation.isPending}
                  data-testid="btn-confirm-add-integration"
                >
                  إضافة
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد تكاملات مكوّنة</p>
          ) : (
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div key={integration.id} className="flex items-center justify-between p-4 rounded-lg border" data-testid={`integration-row-${integration.id}`}>
                  <div className="flex items-center gap-3">
                    <Link2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{integration.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {typeLabels[integration.type] || integration.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={integration.isActive === 'true'} />
                    <Button variant="outline" size="sm">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>إعداد Twilio للرسائل</CardTitle>
          <CardDescription>مفاتيح API لإرسال SMS و WhatsApp</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              لتفعيل إرسال الرسائل، أضف المتغيرات البيئية التالية في إعدادات المشروع:
            </p>
            <ul className="mt-2 text-sm text-blue-700 space-y-1 font-mono">
              <li>TWILIO_ACCOUNT_SID</li>
              <li>TWILIO_AUTH_TOKEN</li>
              <li>TWILIO_PHONE_NUMBER</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
