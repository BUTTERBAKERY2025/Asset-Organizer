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
  Phone,
  Mail,
  CreditCard,
  Calendar,
  Cloud,
  Building2,
  Smartphone,
  Globe,
  Zap,
  Shield,
  AlertCircle,
  ExternalLink
} from "lucide-react";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { toast } from "sonner";
import type { ExternalIntegration, NotificationQueueItem, DataImportJob, AccountingExport } from "@shared/schema";

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

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
    <div className="p-4 md:p-8 lg:p-10 max-w-7xl mx-auto space-y-4" dir="rtl">
      <SettingsBreadcrumb currentPage="التكاملات" currentIcon={Link2} />
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-6">
        <div>
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-butter-dark">التكامل مع الأنظمة الخارجية</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">ربط النظام مع جميع الخدمات والأنظمة الخارجية</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="overflow-x-auto">
          <TabsList className="inline-flex w-auto min-w-full lg:min-w-0">
            <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">نظرة عامة</span>
            </TabsTrigger>
            <TabsTrigger value="sms" className="flex items-center gap-2" data-testid="tab-sms">
              <Smartphone className="h-4 w-4" />
              <span className="hidden sm:inline">SMS/WhatsApp</span>
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2" data-testid="tab-email">
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">البريد</span>
            </TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2" data-testid="tab-payments">
              <CreditCard className="h-4 w-4" />
              <span className="hidden sm:inline">المدفوعات</span>
            </TabsTrigger>
            <TabsTrigger value="calendar" className="flex items-center gap-2" data-testid="tab-calendar">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">التقويم</span>
            </TabsTrigger>
            <TabsTrigger value="storage" className="flex items-center gap-2" data-testid="tab-storage">
              <Cloud className="h-4 w-4" />
              <span className="hidden sm:inline">التخزين</span>
            </TabsTrigger>
            <TabsTrigger value="accounting" className="flex items-center gap-2" data-testid="tab-accounting">
              <Calculator className="h-4 w-4" />
              <span className="hidden sm:inline">المحاسبة</span>
            </TabsTrigger>
            <TabsTrigger value="erp" className="flex items-center gap-2" data-testid="tab-erp">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">ERP</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-6">
          <OverviewSection onNavigate={setActiveTab} />
        </TabsContent>

        <TabsContent value="sms" className="space-y-6">
          <SMSSection notifications={notifications} />
        </TabsContent>

        <TabsContent value="email" className="space-y-6">
          <EmailSection />
        </TabsContent>

        <TabsContent value="payments" className="space-y-6">
          <PaymentsSection />
        </TabsContent>

        <TabsContent value="calendar" className="space-y-6">
          <CalendarSection />
        </TabsContent>

        <TabsContent value="storage" className="space-y-6">
          <StorageSection />
        </TabsContent>

        <TabsContent value="accounting" className="space-y-6">
          <AccountingSection exports={accountingExports} />
        </TabsContent>

        <TabsContent value="erp" className="space-y-6">
          <ERPSection integrations={integrations} importJobs={importJobs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewSection({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const integrationCards = [
    {
      icon: Smartphone,
      title: "SMS / WhatsApp",
      description: "إرسال رسائل نصية وواتساب عبر Twilio",
      status: "متصل",
      statusColor: "bg-green-100 text-green-800",
      provider: "Twilio",
      tab: "sms"
    },
    {
      icon: Mail,
      title: "البريد الإلكتروني",
      description: "إرسال الإشعارات والتقارير بالبريد",
      status: "غير مكوّن",
      statusColor: "bg-gray-100 text-gray-600",
      provider: "SendGrid / SMTP",
      tab: "email"
    },
    {
      icon: CreditCard,
      title: "المدفوعات",
      description: "قبول المدفوعات الإلكترونية",
      status: "غير مكوّن",
      statusColor: "bg-gray-100 text-gray-600",
      provider: "Stripe / PayPal / Tap",
      tab: "payments"
    },
    {
      icon: Calendar,
      title: "التقويم",
      description: "مزامنة المواعيد والاجتماعات",
      status: "غير مكوّن",
      statusColor: "bg-gray-100 text-gray-600",
      provider: "Google Calendar",
      tab: "calendar"
    },
    {
      icon: Cloud,
      title: "التخزين السحابي",
      description: "رفع وحفظ الملفات",
      status: "مفعّل",
      statusColor: "bg-green-100 text-green-800",
      provider: "Replit Object Storage",
      tab: "storage"
    },
    {
      icon: Calculator,
      title: "المحاسبة",
      description: "تصدير البيانات للأنظمة المحاسبية",
      status: "مفعّل",
      statusColor: "bg-green-100 text-green-800",
      provider: "قيود / زوهو / SAP",
      tab: "accounting"
    },
    {
      icon: Building2,
      title: "أنظمة ERP",
      description: "ربط مع أنظمة تخطيط الموارد",
      status: "غير مكوّن",
      statusColor: "bg-gray-100 text-gray-600",
      provider: "SAP / Oracle / Odoo",
      tab: "erp"
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            ملخص التكاملات
          </CardTitle>
          <CardDescription>
            جميع الخدمات والأنظمة المتصلة بنظام باتر
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrationCards.map((integration, index) => (
              <div 
                key={index}
                className="p-4 rounded-lg border hover:border-primary hover:shadow-md transition-all cursor-pointer group"
                data-testid={`integration-card-${integration.tab}`}
                onClick={() => onNavigate(integration.tab)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <integration.icon className="h-6 w-6 text-primary" />
                  </div>
                  <Badge className={integration.statusColor}>
                    {integration.status}
                  </Badge>
                </div>
                <h3 className="font-semibold mb-1">{integration.title}</h3>
                <p className="text-sm text-muted-foreground mb-2">{integration.description}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {integration.provider}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
              <span className="hidden sm:inline">تكاملات نشطة</span>
              <span className="sm:hidden">نشطة</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600">3</div>
            <p className="text-xs sm:text-sm text-muted-foreground">من أصل 7 تكاملات</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
              <Send className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              <span className="hidden sm:inline">رسائل مرسلة</span>
              <span className="sm:hidden">مرسلة</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600">0</div>
            <p className="text-xs sm:text-sm text-muted-foreground">هذا الشهر</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              <span className="hidden sm:inline">أمان التكاملات</span>
              <span className="sm:hidden">الأمان</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">100%</div>
            <p className="text-xs sm:text-sm text-muted-foreground">جميع الاتصالات مشفرة</p>
          </CardContent>
        </Card>

        <Card className="col-span-2 lg:col-span-1">
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
              <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-amber-500" />
              <span className="hidden sm:inline">حالة النظام</span>
              <span className="sm:hidden">النظام</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-amber-600">فعّال</div>
            <p className="text-xs sm:text-sm text-muted-foreground">جميع الخدمات تعمل</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SMSSection({ notifications }: { notifications: NotificationQueueItem[] }) {
  const queryClient = useQueryClient();
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientName, setRecipientName] = useState("");
  const [message, setMessage] = useState("");
  const [channel, setChannel] = useState("sms");
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [twilioInfo, setTwilioInfo] = useState<{
    connected: boolean;
    accountName?: string;
    status?: string;
    type?: string;
  }>({ connected: false });

  // Check Twilio status on mount
  const { isLoading: isTwilioLoading } = useQuery({
    queryKey: ["/api/integrations/twilio/status"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/integrations/twilio/test", {
          method: "POST",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setTwilioInfo({
            connected: true,
            accountName: data.accountName,
            status: data.status,
            type: data.type,
          });
          return data;
        }
        setTwilioInfo({ connected: false });
        return null;
      } catch {
        setTwilioInfo({ connected: false });
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

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

  const testConnection = async () => {
    setTestStatus("testing");
    try {
      const res = await fetch("/api/integrations/twilio/test", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setTestStatus("success");
        toast.success("اتصال Twilio يعمل بنجاح!");
      } else {
        setTestStatus("error");
        toast.error("فشل في الاتصال بـ Twilio");
      }
    } catch {
      setTestStatus("error");
      toast.error("خطأ في الاتصال");
    }
  };

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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5 text-green-600" />
              حالة Twilio
            </CardTitle>
            <CardDescription>إعدادات خدمة الرسائل النصية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTwilioLoading ? (
              <div className="flex items-center justify-center p-3 bg-gray-50 rounded-lg border">
                <RefreshCw className="h-5 w-5 animate-spin text-gray-400 ml-2" />
                <span className="text-gray-600">جاري التحقق...</span>
              </div>
            ) : twilioInfo.connected ? (
              <>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">متصل</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {twilioInfo.type === 'Trial' ? 'حساب تجريبي' : 'حساب مدفوع'}
                  </Badge>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">اسم الحساب</span>
                    <span className="font-medium">{twilioInfo.accountName || '-'}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">الحالة</span>
                    <span className="font-medium text-green-600">
                      {twilioInfo.status === 'active' ? 'نشط' : twilioInfo.status}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-600" />
                  <span className="font-medium text-yellow-800">غير متصل</span>
                </div>
              </div>
            )}

            <Button 
              variant="outline" 
              className="w-full"
              onClick={testConnection}
              disabled={testStatus === "testing"}
              data-testid="btn-test-twilio"
            >
              {testStatus === "testing" ? (
                <RefreshCw className="h-4 w-4 ml-2 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 ml-2" />
              )}
              اختبار الاتصال
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-green-600" />
              WhatsApp Business
            </CardTitle>
            <CardDescription>إرسال رسائل واتساب</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">يتطلب إعداد</span>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground">
              لتفعيل WhatsApp Business، تحتاج إلى:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>حساب WhatsApp Business API</li>
              <li>ربط الحساب مع Twilio</li>
              <li>الموافقة على قوالب الرسائل</li>
            </ul>

            <Button variant="outline" className="w-full" data-testid="btn-setup-whatsapp">
              <ExternalLink className="h-4 w-4 ml-2" />
              إعداد WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            إرسال رسالة جديدة
          </CardTitle>
          <CardDescription>
            إرسال رسائل SMS أو WhatsApp للموظفين والعملاء
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-amber-800">
              <AlertCircle className="h-5 w-5" />
              <span className="font-medium">ملاحظة - حساب تجريبي:</span>
            </div>
            <p className="text-sm text-amber-700 mt-1">
              يمكنك إرسال الرسائل فقط للأرقام المُفعّلة في لوحة Twilio. للإرسال لأي رقم، يجب ترقية الحساب.
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
                <SelectItem value="whatsapp" disabled>WhatsApp (يتطلب إعداد)</SelectItem>
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
            إرسال الرسالة
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>سجل الرسائل</CardTitle>
          <CardDescription>جميع الرسائل المرسلة والمنتظرة</CardDescription>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد رسائل بعد</p>
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

function EmailSection() {
  const [emailProvider, setEmailProvider] = useState("sendgrid");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-600" />
              SendGrid
            </CardTitle>
            <CardDescription>خدمة البريد الإلكتروني المتقدمة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>API Key</Label>
                <Input type="password" placeholder="SG.xxxxxxxx" data-testid="input-sendgrid-key" />
              </div>
              <div className="space-y-2">
                <Label>البريد المرسل</Label>
                <Input type="email" placeholder="noreply@butterbakery.sa" data-testid="input-sender-email" />
              </div>
            </div>

            <Button className="w-full" data-testid="btn-connect-sendgrid">
              <Zap className="h-4 w-4 ml-2" />
              ربط SendGrid
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-purple-600" />
              SMTP مخصص
            </CardTitle>
            <CardDescription>استخدام خادم بريد خاص</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>الخادم</Label>
                <Input placeholder="smtp.example.com" data-testid="input-smtp-host" />
              </div>
              <div className="space-y-2">
                <Label>المنفذ</Label>
                <Input placeholder="587" data-testid="input-smtp-port" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>اسم المستخدم</Label>
                <Input data-testid="input-smtp-user" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <Input type="password" data-testid="input-smtp-pass" />
              </div>
            </div>

            <Button variant="outline" className="w-full" data-testid="btn-connect-smtp">
              <Zap className="h-4 w-4 ml-2" />
              ربط SMTP
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>قوالب البريد</CardTitle>
          <CardDescription>قوالب جاهزة للإشعارات التلقائية</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { name: "ترحيب مستخدم جديد", status: "فعال" },
              { name: "تذكير بالمهام", status: "فعال" },
              { name: "تقرير يومي", status: "معطل" },
              { name: "تنبيه المخزون", status: "فعال" },
              { name: "إشعار الصيانة", status: "معطل" },
              { name: "تأكيد الطلب", status: "فعال" },
            ].map((template, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                <span className="font-medium text-sm">{template.name}</span>
                <Badge variant={template.status === "فعال" ? "default" : "secondary"}>
                  {template.status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-purple-600" />
              Stripe
            </CardTitle>
            <CardDescription>بوابة دفع عالمية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              قبول بطاقات الائتمان والخصم (Visa, Mastercard, AMEX)
            </p>

            <Button className="w-full" data-testid="btn-connect-stripe">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط Stripe
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              PayPal
            </CardTitle>
            <CardDescription>مدفوعات PayPal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              قبول مدفوعات PayPal وبطاقات الائتمان
            </p>

            <Button variant="outline" className="w-full" data-testid="btn-connect-paypal">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط PayPal
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-600" />
              Tap Payments
            </CardTitle>
            <CardDescription>بوابة دفع خليجية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              مدفوعات Mada, Apple Pay, STC Pay
            </p>

            <Button variant="outline" className="w-full" data-testid="btn-connect-tap">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط Tap
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>سجل المعاملات</CardTitle>
          <CardDescription>المعاملات المالية الأخيرة</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            لا توجد معاملات - قم بربط بوابة دفع أولاً
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Google Calendar
            </CardTitle>
            <CardDescription>مزامنة المواعيد والاجتماعات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                مزامنة الاجتماعات تلقائياً
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                تذكيرات بالمواعيد
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                حجز المواعيد للزوار
              </li>
            </ul>

            <Button className="w-full" data-testid="btn-connect-google-calendar">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط Google Calendar
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              Microsoft Outlook
            </CardTitle>
            <CardDescription>تقويم مايكروسوفت</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                تكامل مع Microsoft 365
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                مزامنة جهات الاتصال
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                اجتماعات Teams
              </li>
            </ul>

            <Button variant="outline" className="w-full" data-testid="btn-connect-outlook">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط Outlook
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>الأحداث القادمة</CardTitle>
          <CardDescription>المواعيد المجدولة من التقويمات المرتبطة</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            لا توجد أحداث - قم بربط تقويم أولاً
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function StorageSection() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-600" />
              Replit Storage
            </CardTitle>
            <CardDescription>التخزين المدمج</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">مفعّل</span>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">المستخدم</span>
                <span className="font-medium">2.5 GB</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">الحد الأقصى</span>
                <span className="font-medium">10 GB</span>
              </div>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full" style={{ width: '25%' }}></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-yellow-600" />
              Google Drive
            </CardTitle>
            <CardDescription>تخزين Google</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              حفظ النسخ الاحتياطية والتقارير في Google Drive
            </p>

            <Button variant="outline" className="w-full" data-testid="btn-connect-gdrive">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط Google Drive
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-500" />
              Dropbox
            </CardTitle>
            <CardDescription>تخزين Dropbox</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              مزامنة الملفات مع Dropbox Business
            </p>

            <Button variant="outline" className="w-full" data-testid="btn-connect-dropbox">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط Dropbox
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>إعدادات النسخ الاحتياطي</CardTitle>
          <CardDescription>جدولة النسخ الاحتياطي التلقائي</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">نسخ احتياطي يومي</p>
              <p className="text-sm text-muted-foreground">حفظ نسخة كل يوم الساعة 3 صباحاً</p>
            </div>
            <Switch data-testid="switch-daily-backup" />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">نسخ احتياطي للوثائق</p>
              <p className="text-sm text-muted-foreground">حفظ الوثائق في التخزين السحابي</p>
            </div>
            <Switch data-testid="switch-docs-backup" />
          </div>
        </CardContent>
      </Card>
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
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600" />
              قيود المحاسبي
            </CardTitle>
            <CardDescription>نظام المحاسبة السحابي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              ربط مباشر مع نظام قيود لتصدير القيود المحاسبية تلقائياً
            </p>

            <Button variant="outline" className="w-full" data-testid="btn-connect-qoyod">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط قيود
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-red-600" />
              Zoho Books
            </CardTitle>
            <CardDescription>نظام زوهو المحاسبي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              تكامل مع Zoho Books لإدارة الفواتير والمصروفات
            </p>

            <Button variant="outline" className="w-full" data-testid="btn-connect-zoho">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط Zoho
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>تصدير البيانات المحاسبية</CardTitle>
          <CardDescription>تصدير التقارير بصيغة JSON للأنظمة المحاسبية</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="h-4 w-4 text-blue-600" />
                  تقييم المخزون
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                  <SelectTrigger data-testid="select-branch">
                    <SelectValue placeholder="جميع الفروع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفروع</SelectItem>
                    {(branches as any[]).map((branch: any) => (
                      <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button 
                  onClick={() => inventoryValuationMutation.mutate(selectedBranch === "all" ? undefined : selectedBranch || undefined)}
                  disabled={inventoryValuationMutation.isPending}
                  className="w-full"
                  size="sm"
                  data-testid="btn-export-valuation"
                >
                  <Download className="h-4 w-4 ml-2" />
                  تصدير
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-green-600" />
                  حركة الأصول
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} placeholder="من" data-testid="input-date-from" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} placeholder="إلى" data-testid="input-date-to" />
                </div>
                <Button 
                  onClick={() => assetMovementsMutation.mutate()}
                  disabled={assetMovementsMutation.isPending}
                  className="w-full"
                  size="sm"
                  data-testid="btn-export-movements"
                >
                  <Download className="h-4 w-4 ml-2" />
                  تصدير
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-purple-600" />
                  تكاليف المشاريع
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  جميع المشاريع مع الميزانيات والمصروفات
                </p>
                <Button 
                  onClick={() => projectCostsMutation.mutate()}
                  disabled={projectCostsMutation.isPending}
                  className="w-full"
                  size="sm"
                  data-testid="btn-export-projects"
                >
                  <Download className="h-4 w-4 ml-2" />
                  تصدير
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

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
                    {new Date(exp.createdAt).toLocaleDateString('en-GB')}
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

function ERPSection({ integrations, importJobs }: { integrations: ExternalIntegration[], importJobs: DataImportJob[] }) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newIntegration, setNewIntegration] = useState({ name: "", type: "erp" });

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
      setNewIntegration({ name: "", type: "erp" });
    },
    onError: () => toast.error("فشل في إضافة التكامل"),
  });

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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              SAP Business One
            </CardTitle>
            <CardDescription>نظام تخطيط موارد المؤسسة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              تكامل مع SAP لمزامنة المخزون والطلبات
            </p>

            <Button variant="outline" className="w-full" data-testid="btn-connect-sap">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط SAP
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-red-600" />
              Oracle NetSuite
            </CardTitle>
            <CardDescription>نظام Oracle السحابي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              تكامل شامل مع Oracle NetSuite
            </p>

            <Button variant="outline" className="w-full" data-testid="btn-connect-oracle">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط Oracle
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-purple-600" />
              Odoo
            </CardTitle>
            <CardDescription>نظام ERP مفتوح المصدر</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-gray-400" />
                <span className="text-gray-600">غير مكوّن</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              تكامل مع Odoo للمحاسبة والمخزون
            </p>

            <Button variant="outline" className="w-full" data-testid="btn-connect-odoo">
              <ExternalLink className="h-4 w-4 ml-2" />
              ربط Odoo
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              استيراد البيانات
            </CardTitle>
            <CardDescription>استيراد بيانات من ملفات Excel أو أنظمة خارجية</CardDescription>
          </div>
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

            <div className="p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Link2 className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-medium">استيراد من API</h3>
                  <p className="text-sm text-muted-foreground">ربط مع أنظمة ERP</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                ربط مباشر مع أنظمة تخطيط الموارد
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>التكاملات المكوّنة</CardTitle>
            <CardDescription>الاتصالات النشطة مع الأنظمة الخارجية</CardDescription>
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
                    placeholder="مثال: نظام SAP"
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
                      <SelectItem value="payments">بوابة دفع</SelectItem>
                      <SelectItem value="storage">تخزين سحابي</SelectItem>
                      <SelectItem value="calendar">تقويم</SelectItem>
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
            <p className="text-center text-muted-foreground py-8">لا توجد تكاملات مكوّنة بعد</p>
          ) : (
            <div className="space-y-3">
              {integrations.map((integration) => (
                <div key={integration.id} className="flex items-center justify-between p-4 rounded-lg border" data-testid={`integration-row-${integration.id}`}>
                  <div className="flex items-center gap-3">
                    <Link2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{integration.name}</p>
                      <p className="text-sm text-muted-foreground">{integration.type}</p>
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

      {importJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>سجل عمليات الاستيراد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {importJobs.map((job) => (
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
                    {new Date(job.createdAt).toLocaleDateString('en-GB')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
