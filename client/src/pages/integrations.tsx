import { useState, useEffect } from "react";
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
import { 
  Link2, 
  MessageSquare, 
  FileSpreadsheet, 
  Calculator,
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
  ExternalLink,
  Save,
  Eye,
  EyeOff,
  Loader2
} from "lucide-react";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { toast } from "sonner";
import type { NotificationQueueItem, AccountingExport } from "@shared/schema";

interface IntegrationSetting {
  type: string;
  configured: boolean;
  id?: number;
  name?: string;
  config: Record<string, any>;
  isActive?: string;
  lastSyncAt?: string | null;
  updatedAt?: string;
}

function useIntegrationSettings(type: string) {
  return useQuery<IntegrationSetting>({
    queryKey: [`/api/integration-settings/${type}`],
    staleTime: 30000,
  });
}

function useSaveIntegration(type: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; config: Record<string, any>; isActive?: string }) => {
      const res = await fetch(`/api/integration-settings/${type}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("فشل في حفظ الإعدادات");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/integration-settings/${type}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/integration-settings"] });
      toast.success("تم حفظ الإعدادات بنجاح");
    },
    onError: () => toast.error("فشل في حفظ الإعدادات"),
  });
}

function useTestIntegration(type: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/integration-settings/${type}/test`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("فشل في اختبار الاتصال");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: [`/api/integration-settings/${type}`] });
        toast.success(data.message || "تم الاتصال بنجاح");
      } else {
        toast.error(data.error || "فشل في الاتصال");
      }
    },
    onError: () => toast.error("فشل في اختبار الاتصال"),
  });
}

function SecureInput({ value, onChange, placeholder, testId }: { value: string; onChange: (v: string) => void; placeholder?: string; testId?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        data-testid={testId}
        dir="ltr"
        className="pl-10"
      />
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function StatusBadge({ configured, isActive }: { configured: boolean; isActive?: string }) {
  if (!configured) {
    return (
      <div className="flex items-center gap-2 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
        <AlertCircle className="h-5 w-5 text-yellow-600" />
        <span className="font-medium text-yellow-800">غير مُعدّ</span>
      </div>
    );
  }
  if (isActive === 'true') {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg border border-green-200">
        <CheckCircle className="h-5 w-5 text-green-600" />
        <span className="font-medium text-green-800">مفعّل ومتصل</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
      <XCircle className="h-5 w-5 text-gray-400" />
      <span className="text-gray-600">معطّل</span>
    </div>
  );
}

export default function IntegrationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: notifications = [] } = useQuery<NotificationQueueItem[]>({
    queryKey: ["/api/notifications"],
  });

  const { data: accountingExports = [] } = useQuery<AccountingExport[]>({
    queryKey: ["/api/accounting-exports"],
  });

  return (
    <div className="p-4 md:p-8 lg:p-10 max-w-[1400px] mx-auto space-y-4" dir="rtl">
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
          <ERPSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewSection({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { data: allSettings = [] } = useQuery<IntegrationSetting[]>({
    queryKey: ["/api/integration-settings"],
    staleTime: 30000,
  });

  const { data: twilioStatus } = useQuery({
    queryKey: ["/api/integrations/twilio/status"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/twilio/status", { credentials: "include" });
      if (!res.ok) return { configured: false, connected: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  function getStatus(type: string): { status: string; color: string } {
    if (type === 'sms') {
      if (twilioStatus?.connected) return { status: "متصل", color: "bg-green-100 text-green-800" };
      if (twilioStatus?.configured) return { status: "مكوّن", color: "bg-blue-100 text-blue-800" };
      return { status: "غير مكوّن", color: "bg-gray-100 text-gray-600" };
    }
    if (type === 'storage') return { status: "مفعّل", color: "bg-green-100 text-green-800" };
    const setting = allSettings.find(s => s.type === type);
    if (setting?.isActive === 'true') return { status: "مفعّل", color: "bg-green-100 text-green-800" };
    if (setting) return { status: "مكوّن", color: "bg-blue-100 text-blue-800" };
    return { status: "غير مكوّن", color: "bg-gray-100 text-gray-600" };
  }

  const integrationCards = [
    { icon: Smartphone, title: "SMS / WhatsApp", description: "إرسال رسائل نصية وواتساب عبر Twilio", provider: "Twilio", tab: "sms" },
    { icon: Mail, title: "البريد الإلكتروني", description: "إرسال الإشعارات والتقارير بالبريد", provider: "SendGrid / SMTP", tab: "email" },
    { icon: CreditCard, title: "المدفوعات", description: "قبول المدفوعات الإلكترونية", provider: "Stripe / Tap Payments", tab: "payments" },
    { icon: Calendar, title: "التقويم", description: "مزامنة المواعيد والاجتماعات", provider: "Google Calendar", tab: "calendar" },
    { icon: Cloud, title: "التخزين السحابي", description: "رفع وحفظ الملفات", provider: "Supabase Storage", tab: "storage" },
    { icon: Calculator, title: "المحاسبة", description: "تصدير البيانات للأنظمة المحاسبية", provider: "قيود / Zoho Books", tab: "accounting" },
    { icon: Building2, title: "أنظمة ERP", description: "ربط مع أنظمة تخطيط الموارد", provider: "SAP / Odoo", tab: "erp" },
  ];

  const activeCount = integrationCards.filter(c => {
    const s = getStatus(c.tab);
    return s.status === "متصل" || s.status === "مفعّل";
  }).length;

  const configuredCount = integrationCards.filter(c => {
    const s = getStatus(c.tab);
    return s.status !== "غير مكوّن";
  }).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            ملخص التكاملات
          </CardTitle>
          <CardDescription>جميع الخدمات والأنظمة المتصلة بنظام باتر</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {integrationCards.map((integration, index) => {
              const s = getStatus(integration.tab);
              return (
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
                    <Badge className={s.color}>{s.status}</Badge>
                  </div>
                  <h3 className="font-semibold mb-1">{integration.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">{integration.description}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    {integration.provider}
                  </p>
                </div>
              );
            })}
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
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600" data-testid="text-active-count">{activeCount}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">من أصل {integrationCards.length} تكاملات</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
              <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              <span className="hidden sm:inline">مكوّنة</span>
              <span className="sm:hidden">مكوّنة</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-blue-600" data-testid="text-configured-count">{configuredCount}</div>
            <p className="text-xs sm:text-sm text-muted-foreground">تكاملات تم إعدادها</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 sm:p-4 pb-2">
            <CardTitle className="text-sm sm:text-base md:text-lg flex items-center gap-2">
              <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              <span className="hidden sm:inline">الأمان</span>
              <span className="sm:hidden">الأمان</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600">100%</div>
            <p className="text-xs sm:text-sm text-muted-foreground">اتصالات مشفرة</p>
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
  const [testSmsPhone, setTestSmsPhone] = useState("");
  const [testSmsResult, setTestSmsResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: twilioStatus, isLoading: isTwilioLoading, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/integrations/twilio/status"],
    queryFn: async () => {
      const res = await fetch("/api/integrations/twilio/status", { credentials: "include" });
      if (!res.ok) return { configured: false, connected: false };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ recipientPhone, recipientName, channel, message }),
      });
      if (!res.ok) throw new Error("فشل في إرسال الإشعار");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      if (data?.status === "failed") toast.error("فشل في إرسال الرسالة");
      else if (data?.status === "sent") toast.success("تم إرسال الرسالة بنجاح");
      else toast.success("تم إضافة الرسالة لقائمة الإرسال");
      setRecipientPhone(""); setRecipientName(""); setMessage("");
    },
    onError: () => toast.error("فشل في إرسال الإشعار"),
  });

  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  const testConnection = async () => {
    setTestStatus("testing");
    try {
      const res = await fetch("/api/integrations/twilio/test", { method: "POST", credentials: "include" });
      if (res.ok) { setTestStatus("success"); toast.success("اتصال Twilio يعمل بنجاح!"); refetchStatus(); }
      else { setTestStatus("error"); toast.error("فشل في الاتصال بـ Twilio"); }
    } catch { setTestStatus("error"); toast.error("خطأ في الاتصال"); }
  };

  const sendTestSms = async () => {
    setTestSmsResult(null);
    try {
      const res = await fetch("/api/integrations/twilio/test-sms", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ phone: testSmsPhone, message: "رسالة اختبار من نظام باتر" }),
      });
      const data = await res.json();
      if (res.ok) { setTestSmsResult({ success: true, message: data.message || "تم الإرسال بنجاح" }); toast.success("تم الإرسال بنجاح"); }
      else { setTestSmsResult({ success: false, message: data.error || "فشل في الإرسال" }); toast.error(data.error || "فشل"); }
    } catch { setTestSmsResult({ success: false, message: "خطأ في الاتصال" }); toast.error("خطأ في الاتصال"); }
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="h-4 w-4 text-yellow-500" />,
    sent: <CheckCircle className="h-4 w-4 text-green-500" />,
    failed: <XCircle className="h-4 w-4 text-red-500" />,
  };
  const statusLabels: Record<string, string> = { pending: "في الانتظار", sent: "تم الإرسال", failed: "فشل" };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5 text-green-600" />حالة Twilio</CardTitle>
            <CardDescription>إعدادات خدمة الرسائل النصية والواتساب</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isTwilioLoading ? (
              <div className="flex items-center justify-center p-3 bg-gray-50 rounded-lg border">
                <RefreshCw className="h-5 w-5 animate-spin text-gray-400 ml-2" />
                <span className="text-gray-600">جاري التحقق...</span>
              </div>
            ) : twilioStatus?.connected ? (
              <>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800">متصل</span>
                  </div>
                  <Badge className="bg-green-100 text-green-800">
                    {twilioStatus.type === 'Trial' ? 'حساب تجريبي' : 'حساب مدفوع'}
                  </Badge>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">اسم الحساب</span>
                    <span className="font-medium">{twilioStatus.accountName || '-'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">حالة الحساب</span>
                    <span className="font-medium text-green-600">{twilioStatus.status === 'active' ? 'نشط' : twilioStatus.status}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-muted-foreground">رقم الهاتف</span>
                    <span className="font-medium" dir="ltr">{twilioStatus.phoneNumber || '-'}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                    <span className="font-medium text-yellow-800">{twilioStatus?.configured === false ? 'غير مُعدّ' : 'غير متصل'}</span>
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800 font-medium mb-2">لتفعيل Twilio:</p>
                  <ul className="text-xs text-blue-700 space-y-1">
                    <li>1. أنشئ حساب في <a href="https://www.twilio.com" target="_blank" rel="noreferrer" className="underline">twilio.com</a></li>
                    <li>2. أضف المتغيرات التالية في إعدادات البيئة:</li>
                    <li className="font-mono mr-4">TWILIO_ACCOUNT_SID</li>
                    <li className="font-mono mr-4">TWILIO_AUTH_TOKEN</li>
                    <li className="font-mono mr-4">TWILIO_PHONE_NUMBER</li>
                  </ul>
                </div>
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={testConnection} disabled={testStatus === "testing"} data-testid="btn-test-twilio">
              {testStatus === "testing" ? <RefreshCw className="h-4 w-4 ml-2 animate-spin" /> : <Zap className="h-4 w-4 ml-2" />}
              اختبار الاتصال
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-blue-600" />اختبار إرسال SMS</CardTitle>
            <CardDescription>إرسال رسالة اختبار للتأكد من عمل الخدمة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input placeholder="05XXXXXXXX" value={testSmsPhone} onChange={(e) => setTestSmsPhone(e.target.value)} data-testid="input-test-sms-phone" dir="ltr" />
            </div>
            <Button className="w-full" onClick={sendTestSms} disabled={!testSmsPhone} data-testid="btn-send-test-sms">
              <Send className="h-4 w-4 ml-2" />إرسال رسالة اختبار
            </Button>
            {testSmsResult && (
              <div className={`flex items-center gap-2 p-3 rounded-lg border ${testSmsResult.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`} data-testid="test-sms-result">
                {testSmsResult.success ? <CheckCircle className="h-5 w-5 text-green-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                <span className="text-sm font-medium">{testSmsResult.message}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" />إرسال رسالة جديدة</CardTitle>
          <CardDescription>إرسال رسائل SMS أو WhatsApp للموظفين والعملاء</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input placeholder="05XXXXXXXX" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} data-testid="input-recipient-phone" dir="ltr" />
              <p className="text-xs text-muted-foreground">صيغة سعودية: 05XXXXXXXX أو +966XXXXXXXXX</p>
            </div>
            <div className="space-y-2">
              <Label>اسم المستلم</Label>
              <Input placeholder="اسم المستلم" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} data-testid="input-recipient-name" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>قناة الإرسال</Label>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger data-testid="select-channel"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>نص الرسالة</Label>
            <Textarea placeholder="أدخل نص الرسالة..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} data-testid="input-message" />
          </div>
          <Button onClick={() => sendNotificationMutation.mutate()} disabled={sendNotificationMutation.isPending || !recipientPhone || !message} data-testid="btn-send-notification">
            <Send className="h-4 w-4 ml-2" />إرسال الرسالة
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><MessageSquare className="h-5 w-5" />سجل الرسائل</CardTitle>
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
                    <p className="text-xs text-muted-foreground mt-1">{statusLabels[notification.status]}</p>
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
  const { data: sendgridSettings } = useIntegrationSettings('sendgrid');
  const { data: smtpSettings } = useIntegrationSettings('smtp');
  const saveSendgrid = useSaveIntegration('sendgrid');
  const saveSmtp = useSaveIntegration('smtp');
  const testSendgrid = useTestIntegration('sendgrid');
  const testSmtp = useTestIntegration('smtp');

  const [sgKey, setSgKey] = useState("");
  const [sgEmail, setSgEmail] = useState("");
  const [sgName, setSgName] = useState("");

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [smtpSecure, setSmtpSecure] = useState(true);

  useEffect(() => {
    if (sendgridSettings?.config) {
      setSgKey(sendgridSettings.config.apiKey || "");
      setSgEmail(sendgridSettings.config.fromEmail || "");
      setSgName(sendgridSettings.config.fromName || "");
    }
  }, [sendgridSettings]);

  useEffect(() => {
    if (smtpSettings?.config) {
      setSmtpHost(smtpSettings.config.host || "");
      setSmtpPort(smtpSettings.config.port || "");
      setSmtpUser(smtpSettings.config.username || "");
      setSmtpPass(smtpSettings.config.password || "");
      setSmtpFrom(smtpSettings.config.fromEmail || "");
      setSmtpSecure(smtpSettings.config.secure !== false);
    }
  }, [smtpSettings]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-blue-600" />SendGrid</CardTitle>
            <CardDescription>خدمة البريد الإلكتروني المتقدمة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={sendgridSettings?.configured || false} isActive={sendgridSettings?.isActive} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>مفتاح API</Label>
                <SecureInput value={sgKey} onChange={setSgKey} placeholder="SG.xxxxxxxx" testId="input-sendgrid-key" />
                <p className="text-xs text-muted-foreground">
                  احصل على المفتاح من <a href="https://app.sendgrid.com/settings/api_keys" target="_blank" rel="noreferrer" className="underline text-primary">لوحة تحكم SendGrid</a>
                </p>
              </div>
              <div className="space-y-2">
                <Label>البريد المرسل</Label>
                <Input type="email" value={sgEmail} onChange={(e) => setSgEmail(e.target.value)} placeholder="noreply@butterbakery.sa" data-testid="input-sendgrid-email" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>اسم المرسل</Label>
                <Input value={sgName} onChange={(e) => setSgName(e.target.value)} placeholder="نظام باتر" data-testid="input-sendgrid-name" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => saveSendgrid.mutate({ name: "SendGrid", config: { apiKey: sgKey, fromEmail: sgEmail, fromName: sgName } })} disabled={saveSendgrid.isPending || !sgKey} data-testid="btn-save-sendgrid">
                {saveSendgrid.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ
              </Button>
              <Button variant="outline" onClick={() => testSendgrid.mutate()} disabled={testSendgrid.isPending || !sendgridSettings?.configured} data-testid="btn-test-sendgrid">
                {testSendgrid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5 text-purple-600" />SMTP مخصص</CardTitle>
            <CardDescription>استخدام خادم بريد خاص</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={smtpSettings?.configured || false} isActive={smtpSettings?.isActive} />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>الخادم</Label>
                <Input value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} placeholder="smtp.example.com" data-testid="input-smtp-host" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>المنفذ</Label>
                <Input value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} placeholder="587" data-testid="input-smtp-port" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>اسم المستخدم</Label>
                <Input value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} data-testid="input-smtp-user" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <SecureInput value={smtpPass} onChange={setSmtpPass} testId="input-smtp-pass" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>البريد المرسل</Label>
              <Input type="email" value={smtpFrom} onChange={(e) => setSmtpFrom(e.target.value)} placeholder="noreply@butterbakery.sa" data-testid="input-smtp-from" dir="ltr" />
            </div>
            <div className="flex items-center justify-between">
              <Label>تشفير TLS/SSL</Label>
              <Switch checked={smtpSecure} onCheckedChange={setSmtpSecure} data-testid="switch-smtp-secure" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => saveSmtp.mutate({ name: "SMTP", config: { host: smtpHost, port: smtpPort, username: smtpUser, password: smtpPass, fromEmail: smtpFrom, secure: smtpSecure } })} disabled={saveSmtp.isPending || !smtpHost} data-testid="btn-save-smtp">
                {saveSmtp.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ
              </Button>
              <Button variant="outline" onClick={() => testSmtp.mutate()} disabled={testSmtp.isPending || !smtpSettings?.configured} data-testid="btn-test-smtp">
                {testSmtp.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
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
                <Badge variant={template.status === "فعال" ? "default" : "secondary"}>{template.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PaymentsSection() {
  const { data: stripeSettings } = useIntegrationSettings('stripe');
  const { data: tapSettings } = useIntegrationSettings('tap');
  const saveStripe = useSaveIntegration('stripe');
  const saveTap = useSaveIntegration('tap');
  const testStripe = useTestIntegration('stripe');
  const testTap = useTestIntegration('tap');

  const [stripePublicKey, setStripePublicKey] = useState("");
  const [stripeSecretKey, setStripeSecretKey] = useState("");
  const [stripeWebhook, setStripeWebhook] = useState("");

  const [tapPublicKey, setTapPublicKey] = useState("");
  const [tapSecretKey, setTapSecretKey] = useState("");
  const [tapMerchantId, setTapMerchantId] = useState("");

  useEffect(() => {
    if (stripeSettings?.config) {
      setStripePublicKey(stripeSettings.config.publishableKey || "");
      setStripeSecretKey(stripeSettings.config.secretKey || "");
      setStripeWebhook(stripeSettings.config.webhookSecret || "");
    }
  }, [stripeSettings]);

  useEffect(() => {
    if (tapSettings?.config) {
      setTapPublicKey(tapSettings.config.publishableKey || "");
      setTapSecretKey(tapSettings.config.secretKey || "");
      setTapMerchantId(tapSettings.config.merchantId || "");
    }
  }, [tapSettings]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-purple-600" />Stripe</CardTitle>
            <CardDescription>بوابة دفع عالمية - Visa, Mastercard, AMEX</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={stripeSettings?.configured || false} isActive={stripeSettings?.isActive} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>المفتاح العام (Publishable Key)</Label>
                <Input value={stripePublicKey} onChange={(e) => setStripePublicKey(e.target.value)} placeholder="pk_live_xxxxxxxx" data-testid="input-stripe-public" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>المفتاح السري (Secret Key)</Label>
                <SecureInput value={stripeSecretKey} onChange={setStripeSecretKey} placeholder="sk_live_xxxxxxxx" testId="input-stripe-secret" />
              </div>
              <div className="space-y-2">
                <Label>مفتاح Webhook (اختياري)</Label>
                <SecureInput value={stripeWebhook} onChange={setStripeWebhook} placeholder="whsec_xxxxxxxx" testId="input-stripe-webhook" />
              </div>
              <p className="text-xs text-muted-foreground">
                احصل على المفاتيح من <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className="underline text-primary">لوحة تحكم Stripe</a>
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => saveStripe.mutate({ name: "Stripe", config: { publishableKey: stripePublicKey, secretKey: stripeSecretKey, webhookSecret: stripeWebhook } })} disabled={saveStripe.isPending || !stripeSecretKey} data-testid="btn-save-stripe">
                {saveStripe.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ
              </Button>
              <Button variant="outline" onClick={() => testStripe.mutate()} disabled={testStripe.isPending || !stripeSettings?.configured} data-testid="btn-test-stripe">
                {testStripe.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-green-600" />Tap Payments</CardTitle>
            <CardDescription>بوابة دفع خليجية - Mada, Apple Pay, STC Pay</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={tapSettings?.configured || false} isActive={tapSettings?.isActive} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>المفتاح العام (Publishable Key)</Label>
                <Input value={tapPublicKey} onChange={(e) => setTapPublicKey(e.target.value)} placeholder="pk_live_xxxxxxxx" data-testid="input-tap-public" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>المفتاح السري (Secret Key)</Label>
                <SecureInput value={tapSecretKey} onChange={setTapSecretKey} placeholder="sk_live_xxxxxxxx" testId="input-tap-secret" />
              </div>
              <div className="space-y-2">
                <Label>معرّف التاجر (Merchant ID)</Label>
                <Input value={tapMerchantId} onChange={(e) => setTapMerchantId(e.target.value)} placeholder="merchant_xxxxxxxx" data-testid="input-tap-merchant" dir="ltr" />
              </div>
              <p className="text-xs text-muted-foreground">
                احصل على المفاتيح من <a href="https://businesses.tap.company" target="_blank" rel="noreferrer" className="underline text-primary">لوحة تحكم Tap</a>
              </p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => saveTap.mutate({ name: "Tap Payments", config: { publishableKey: tapPublicKey, secretKey: tapSecretKey, merchantId: tapMerchantId } })} disabled={saveTap.isPending || !tapSecretKey} data-testid="btn-save-tap">
                {saveTap.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ
              </Button>
              <Button variant="outline" onClick={() => testTap.mutate()} disabled={testTap.isPending || !tapSettings?.configured} data-testid="btn-test-tap">
                {testTap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function CalendarSection() {
  const { data: googleCalSettings } = useIntegrationSettings('google_calendar');
  const { data: outlookSettings } = useIntegrationSettings('outlook');
  const saveGoogleCal = useSaveIntegration('google_calendar');
  const saveOutlook = useSaveIntegration('outlook');
  const testGoogleCal = useTestIntegration('google_calendar');
  const testOutlook = useTestIntegration('outlook');

  const [gcClientId, setGcClientId] = useState("");
  const [gcClientSecret, setGcClientSecret] = useState("");
  const [gcCalendarId, setGcCalendarId] = useState("");

  const [olClientId, setOlClientId] = useState("");
  const [olClientSecret, setOlClientSecret] = useState("");
  const [olTenantId, setOlTenantId] = useState("");

  useEffect(() => {
    if (googleCalSettings?.config) {
      setGcClientId(googleCalSettings.config.clientId || "");
      setGcClientSecret(googleCalSettings.config.clientSecret || "");
      setGcCalendarId(googleCalSettings.config.calendarId || "");
    }
  }, [googleCalSettings]);

  useEffect(() => {
    if (outlookSettings?.config) {
      setOlClientId(outlookSettings.config.clientId || "");
      setOlClientSecret(outlookSettings.config.clientSecret || "");
      setOlTenantId(outlookSettings.config.tenantId || "");
    }
  }, [outlookSettings]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-blue-600" />Google Calendar</CardTitle>
            <CardDescription>مزامنة المواعيد والاجتماعات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={googleCalSettings?.configured || false} isActive={googleCalSettings?.isActive} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>معرّف العميل (Client ID)</Label>
                <Input value={gcClientId} onChange={(e) => setGcClientId(e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" data-testid="input-gc-client-id" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>المفتاح السري (Client Secret)</Label>
                <SecureInput value={gcClientSecret} onChange={setGcClientSecret} placeholder="GOCSPX-xxxxxxxx" testId="input-gc-secret" />
              </div>
              <div className="space-y-2">
                <Label>معرّف التقويم (Calendar ID)</Label>
                <Input value={gcCalendarId} onChange={(e) => setGcCalendarId(e.target.value)} placeholder="primary أو email@gmail.com" data-testid="input-gc-calendar-id" dir="ltr" />
              </div>
              <p className="text-xs text-muted-foreground">
                أنشئ المشروع من <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="underline text-primary">Google Cloud Console</a>
              </p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />مزامنة الاجتماعات تلقائياً</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />تذكيرات بالمواعيد</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />حجز المواعيد للزوار</li>
            </ul>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => saveGoogleCal.mutate({ name: "Google Calendar", config: { clientId: gcClientId, clientSecret: gcClientSecret, calendarId: gcCalendarId } })} disabled={saveGoogleCal.isPending || !gcClientId} data-testid="btn-save-gcal">
                {saveGoogleCal.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ
              </Button>
              <Button variant="outline" onClick={() => testGoogleCal.mutate()} disabled={testGoogleCal.isPending || !googleCalSettings?.configured} data-testid="btn-test-gcal">
                {testGoogleCal.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5 text-purple-600" />Microsoft Outlook</CardTitle>
            <CardDescription>تقويم مايكروسوفت و Microsoft 365</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={outlookSettings?.configured || false} isActive={outlookSettings?.isActive} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>معرّف التطبيق (Application ID)</Label>
                <Input value={olClientId} onChange={(e) => setOlClientId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" data-testid="input-outlook-client-id" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>المفتاح السري (Client Secret)</Label>
                <SecureInput value={olClientSecret} onChange={setOlClientSecret} testId="input-outlook-secret" />
              </div>
              <div className="space-y-2">
                <Label>معرّف المستأجر (Tenant ID)</Label>
                <Input value={olTenantId} onChange={(e) => setOlTenantId(e.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" data-testid="input-outlook-tenant" dir="ltr" />
              </div>
              <p className="text-xs text-muted-foreground">
                سجّل التطبيق من <a href="https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps" target="_blank" rel="noreferrer" className="underline text-primary">Azure Portal</a>
              </p>
            </div>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />تكامل مع Microsoft 365</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />مزامنة جهات الاتصال</li>
              <li className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-green-500" />اجتماعات Teams</li>
            </ul>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => saveOutlook.mutate({ name: "Microsoft Outlook", config: { clientId: olClientId, clientSecret: olClientSecret, tenantId: olTenantId } })} disabled={saveOutlook.isPending || !olClientId} data-testid="btn-save-outlook">
                {saveOutlook.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ
              </Button>
              <Button variant="outline" onClick={() => testOutlook.mutate()} disabled={testOutlook.isPending || !outlookSettings?.configured} data-testid="btn-test-outlook">
                {testOutlook.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StorageSection() {
  const { data: gdriveSettings } = useIntegrationSettings('google_drive');
  const { data: dropboxSettings } = useIntegrationSettings('dropbox');
  const saveGdrive = useSaveIntegration('google_drive');
  const saveDropbox = useSaveIntegration('dropbox');

  const [gdriveKey, setGdriveKey] = useState("");
  const [gdriveFolderId, setGdriveFolderId] = useState("");

  const [dropboxKey, setDropboxKey] = useState("");
  const [dropboxSecret, setDropboxSecret] = useState("");

  useEffect(() => {
    if (gdriveSettings?.config) {
      setGdriveKey(gdriveSettings.config.serviceAccountKey || "");
      setGdriveFolderId(gdriveSettings.config.folderId || "");
    }
  }, [gdriveSettings]);

  useEffect(() => {
    if (dropboxSettings?.config) {
      setDropboxKey(dropboxSettings.config.accessToken || "");
      setDropboxSecret(dropboxSettings.config.appSecret || "");
    }
  }, [dropboxSettings]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5 text-blue-600" />Supabase Storage</CardTitle>
            <CardDescription>التخزين السحابي الأساسي</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-medium text-green-800">مفعّل - أساسي</span>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">المزود</span>
                <span className="font-medium">Supabase</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">الحالة</span>
                <span className="font-medium text-green-600">متصل</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">التخزين الأساسي للنظام - يُدار عبر متغيرات البيئة (SUPABASE_URL, SUPABASE_ANON_KEY)</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5 text-yellow-600" />Google Drive</CardTitle>
            <CardDescription>نسخ احتياطي وتخزين Google</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={gdriveSettings?.configured || false} isActive={gdriveSettings?.isActive} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>مفتاح حساب الخدمة (Service Account Key)</Label>
                <SecureInput value={gdriveKey} onChange={setGdriveKey} placeholder="JSON key" testId="input-gdrive-key" />
              </div>
              <div className="space-y-2">
                <Label>معرّف المجلد (Folder ID)</Label>
                <Input value={gdriveFolderId} onChange={(e) => setGdriveFolderId(e.target.value)} placeholder="1abc..." data-testid="input-gdrive-folder" dir="ltr" />
              </div>
              <p className="text-xs text-muted-foreground">
                أنشئ حساب خدمة من <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noreferrer" className="underline text-primary">Google Cloud</a>
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => saveGdrive.mutate({ name: "Google Drive", config: { serviceAccountKey: gdriveKey, folderId: gdriveFolderId } })} disabled={saveGdrive.isPending || !gdriveKey} data-testid="btn-save-gdrive">
              {saveGdrive.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
              حفظ الإعدادات
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Cloud className="h-5 w-5 text-blue-500" />Dropbox</CardTitle>
            <CardDescription>تخزين Dropbox Business</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={dropboxSettings?.configured || false} isActive={dropboxSettings?.isActive} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>رمز الوصول (Access Token)</Label>
                <SecureInput value={dropboxKey} onChange={setDropboxKey} testId="input-dropbox-token" />
              </div>
              <div className="space-y-2">
                <Label>المفتاح السري (App Secret)</Label>
                <SecureInput value={dropboxSecret} onChange={setDropboxSecret} testId="input-dropbox-secret" />
              </div>
              <p className="text-xs text-muted-foreground">
                أنشئ التطبيق من <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer" className="underline text-primary">Dropbox Developers</a>
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => saveDropbox.mutate({ name: "Dropbox", config: { accessToken: dropboxKey, appSecret: dropboxSecret } })} disabled={saveDropbox.isPending || !dropboxKey} data-testid="btn-save-dropbox">
              {saveDropbox.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
              حفظ الإعدادات
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
  const [acctTab, setAcctTab] = useState("journal");
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [genDateFrom, setGenDateFrom] = useState("");
  const [genDateTo, setGenDateTo] = useState("");
  const [genBranch, setGenBranch] = useState("");
  const [recPeriodFrom, setRecPeriodFrom] = useState("");
  const [recPeriodTo, setRecPeriodTo] = useState("");
  const [recBranch, setRecBranch] = useState("");
  const [filterEntryType, setFilterEntryType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedEntry, setExpandedEntry] = useState<number | null>(null);

  const { data: qoyodSettings } = useIntegrationSettings('qoyod');
  const { data: zohoSettings } = useIntegrationSettings('zoho');
  const saveQoyod = useSaveIntegration('qoyod');
  const saveZoho = useSaveIntegration('zoho');
  const testQoyod = useTestIntegration('qoyod');
  const testZoho = useTestIntegration('zoho');

  const [qoyodApiKey, setQoyodApiKey] = useState("");
  const [qoyodApiUrl, setQoyodApiUrl] = useState("https://api.qoyod.com/api/2.0");
  const [zohoClientId, setZohoClientId] = useState("");
  const [zohoClientSecret, setZohoClientSecret] = useState("");
  const [zohoOrgId, setZohoOrgId] = useState("");
  const [zohoRegion, setZohoRegion] = useState("sa");

  useEffect(() => {
    if (qoyodSettings?.config) {
      setQoyodApiKey(qoyodSettings.config.apiKey || "");
      setQoyodApiUrl(qoyodSettings.config.apiUrl || "https://api.qoyod.com/api/2.0");
    }
  }, [qoyodSettings]);

  useEffect(() => {
    if (zohoSettings?.config) {
      setZohoClientId(zohoSettings.config.clientId || "");
      setZohoClientSecret(zohoSettings.config.clientSecret || "");
      setZohoOrgId(zohoSettings.config.organizationId || "");
      setZohoRegion(zohoSettings.config.region || "sa");
    }
  }, [zohoSettings]);

  const { data: branches = [] } = useQuery({ queryKey: ["/api/branches"] });

  const journalQueryParams = new URLSearchParams();
  if (dateFrom) journalQueryParams.set('dateFrom', dateFrom);
  if (dateTo) journalQueryParams.set('dateTo', dateTo);
  if (selectedBranch && selectedBranch !== 'all') journalQueryParams.set('branchId', selectedBranch);
  if (filterEntryType && filterEntryType !== 'all') journalQueryParams.set('entryType', filterEntryType);
  if (filterStatus && filterStatus !== 'all') journalQueryParams.set('status', filterStatus);

  const { data: journalEntries = [], isLoading: loadingEntries } = useQuery<any[]>({
    queryKey: ["/api/accounting/journal-entries", journalQueryParams.toString()],
    queryFn: async () => {
      const res = await fetch(`/api/accounting/journal-entries?${journalQueryParams.toString()}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: acctTab === 'journal',
  });

  const { data: reconciliations = [], isLoading: loadingRec } = useQuery<any[]>({
    queryKey: ["/api/accounting/reconciliations"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/reconciliations", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: acctTab === 'reconciliation',
  });

  const { data: chartAccounts = [] } = useQuery<any[]>({
    queryKey: ["/api/accounting/chart-of-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounting/chart-of-accounts", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: acctTab === 'accounts',
  });

  const { data: entryDetails } = useQuery<any>({
    queryKey: ["/api/accounting/journal-entries", expandedEntry],
    queryFn: async () => {
      const res = await fetch(`/api/accounting/journal-entries/${expandedEntry}`, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}: request failed`);
      return res.json();
    },
    enabled: expandedEntry !== null,
  });

  const generateSalesMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting/journal-entries/generate-sales", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ dateFrom: genDateFrom, dateTo: genDateTo, branchId: (genBranch && genBranch !== 'all') ? genBranch : null }) });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["/api/accounting/journal-entries"] }); toast.success(`تم إنشاء ${data.count} قيد مبيعات`); },
    onError: () => toast.error("فشل في إنشاء قيود المبيعات"),
  });

  const generateWasteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting/journal-entries/generate-waste", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ dateFrom: genDateFrom, dateTo: genDateTo, branchId: (genBranch && genBranch !== 'all') ? genBranch : null }) });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ["/api/accounting/journal-entries"] }); toast.success(`تم إنشاء ${data.count} قيد هالك`); },
    onError: () => toast.error("فشل في إنشاء قيود الهالك"),
  });

  const updateEntryStatusMutation = useMutation({
    mutationFn: async ({ id, status, reconciliationStatus }: { id: number; status?: string; reconciliationStatus?: string }) => {
      const res = await fetch(`/api/accounting/journal-entries/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status, reconciliationStatus }) });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/accounting/journal-entries"] }); toast.success("تم تحديث القيد"); },
    onError: () => toast.error("فشل في تحديث القيد"),
  });

  const generateReconciliationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/accounting/reconciliations/generate", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ periodFrom: recPeriodFrom, periodTo: recPeriodTo, branchId: (recBranch && recBranch !== 'all') ? recBranch : null }) });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/accounting/reconciliations"] }); toast.success("تم إنشاء تقرير التسوية"); },
    onError: () => toast.error("فشل في إنشاء تقرير التسوية"),
  });

  const updateRecStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const res = await fetch(`/api/accounting/reconciliations/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ status }) });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/accounting/reconciliations"] }); toast.success("تم تحديث حالة التسوية"); },
    onError: () => toast.error("فشل في التحديث"),
  });

  const inventoryValuationMutation = useMutation({
    mutationFn: async (branchId?: string) => {
      const res = await fetch("/api/accounting-exports/inventory-valuation", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ branchId: branchId || null }) });
      if (!res.ok) throw new Error("فشل");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/accounting-exports"] }); toast.success("تم إنشاء تقرير تقييم المخزون"); },
    onError: () => toast.error("فشل في إنشاء التقرير"),
  });

  const entryTypeLabels: Record<string, string> = { sales: "مبيعات", purchases: "مشتريات", waste: "هالك", production: "إنتاج", transfer: "تحويل", salary: "رواتب", expense: "مصروفات", manual: "يدوي" };
  const statusLabels: Record<string, string> = { draft: "مسودة", posted: "مُرحّل", reconciled: "تمت التسوية", void: "ملغي" };
  const recStatusLabels: Record<string, string> = { pending: "معلّق", matched: "مُطابق", discrepancy: "فرق", resolved: "تم الحل" };
  const recMainStatusLabels: Record<string, string> = { draft: "مسودة", in_review: "قيد المراجعة", approved: "معتمد", exported: "مُصدّر" };
  const accountTypeLabels: Record<string, string> = { asset: "أصول", liability: "التزامات", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات" };

  const exportCSV = (format: string) => {
    const params = new URLSearchParams();
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (selectedBranch && selectedBranch !== 'all') params.set('branchId', selectedBranch);
    params.set('format', format);
    window.open(`/api/accounting/export-csv?${params.toString()}`, '_blank');
  };

  return (
    <div className="space-y-4">
      <Tabs value={acctTab} onValueChange={setAcctTab}>
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="journal" data-testid="tab-acct-journal">القيود المحاسبية</TabsTrigger>
          <TabsTrigger value="reconciliation" data-testid="tab-acct-reconciliation">التسوية المالية</TabsTrigger>
          <TabsTrigger value="accounts" data-testid="tab-acct-accounts">دليل الحسابات</TabsTrigger>
          <TabsTrigger value="export" data-testid="tab-acct-export">التصدير</TabsTrigger>
          <TabsTrigger value="settings" data-testid="tab-acct-settings">الإعدادات</TabsTrigger>
        </TabsList>

        <TabsContent value="journal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-blue-600" />إنشاء القيود المحاسبية</CardTitle>
              <CardDescription>توليد القيود تلقائياً من بيانات المبيعات والهالك</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 items-end">
                <div className="space-y-2">
                  <Label>من تاريخ</Label>
                  <Input type="date" value={genDateFrom} onChange={(e) => setGenDateFrom(e.target.value)} data-testid="input-gen-date-from" />
                </div>
                <div className="space-y-2">
                  <Label>إلى تاريخ</Label>
                  <Input type="date" value={genDateTo} onChange={(e) => setGenDateTo(e.target.value)} data-testid="input-gen-date-to" />
                </div>
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <Select value={genBranch} onValueChange={setGenBranch}>
                    <SelectTrigger data-testid="select-gen-branch"><SelectValue placeholder="جميع الفروع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {(branches as any[]).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => generateSalesMutation.mutate()} disabled={generateSalesMutation.isPending || !genDateFrom || !genDateTo} size="sm" data-testid="btn-gen-sales">
                    {generateSalesMutation.isPending ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <CreditCard className="h-4 w-4 ml-1" />}
                    مبيعات
                  </Button>
                  <Button variant="outline" onClick={() => generateWasteMutation.mutate()} disabled={generateWasteMutation.isPending || !genDateFrom || !genDateTo} size="sm" data-testid="btn-gen-waste">
                    {generateWasteMutation.isPending ? <Loader2 className="h-4 w-4 ml-1 animate-spin" /> : <AlertCircle className="h-4 w-4 ml-1" />}
                    هالك
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <CardTitle>سجل القيود المحاسبية</CardTitle>
                  <CardDescription>{journalEntries.length} قيد</CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Select value={filterEntryType} onValueChange={setFilterEntryType}>
                    <SelectTrigger className="w-32" data-testid="filter-entry-type"><SelectValue placeholder="النوع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="sales">مبيعات</SelectItem>
                      <SelectItem value="waste">هالك</SelectItem>
                      <SelectItem value="purchases">مشتريات</SelectItem>
                      <SelectItem value="manual">يدوي</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32" data-testid="filter-entry-status"><SelectValue placeholder="الحالة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="draft">مسودة</SelectItem>
                      <SelectItem value="posted">مُرحّل</SelectItem>
                      <SelectItem value="reconciled">تمت التسوية</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-36" data-testid="filter-date-from" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-36" data-testid="filter-date-to" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loadingEntries ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : journalEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد قيود محاسبية بعد. استخدم أدوات الإنشاء أعلاه لتوليد القيود.</p>
              ) : (
                <div className="space-y-2">
                  {journalEntries.slice(0, 50).map((entry: any) => (
                    <div key={entry.id} className="border rounded-lg" data-testid={`journal-entry-${entry.id}`}>
                      <div className="flex items-center justify-between p-3 cursor-pointer hover:bg-muted/50" onClick={() => setExpandedEntry(expandedEntry === entry.id ? null : entry.id)}>
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono text-xs">{entry.entryNumber}</Badge>
                          <Badge className={entry.entryType === 'sales' ? 'bg-green-100 text-green-800' : entry.entryType === 'waste' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}>
                            {entryTypeLabels[entry.entryType] || entry.entryType}
                          </Badge>
                          <span className="text-sm">{entry.description}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge variant={entry.status === 'posted' ? 'default' : entry.status === 'reconciled' ? 'default' : 'secondary'}>
                            {statusLabels[entry.status] || entry.status}
                          </Badge>
                          <Badge variant="outline" className={entry.reconciliationStatus === 'matched' ? 'border-green-500 text-green-700' : entry.reconciliationStatus === 'discrepancy' ? 'border-red-500 text-red-700' : ''}>
                            {recStatusLabels[entry.reconciliationStatus] || entry.reconciliationStatus}
                          </Badge>
                          <span className="text-sm font-mono">{parseFloat(entry.totalDebit || 0).toLocaleString('ar-SA')} ر.س</span>
                          <span className="text-xs text-muted-foreground">{entry.entryDate}</span>
                        </div>
                      </div>
                      {expandedEntry === entry.id && entryDetails && (
                        <div className="border-t p-3 bg-muted/30">
                          <div className="mb-3 flex gap-2">
                            {entry.status === 'draft' && (
                              <Button size="sm" variant="outline" onClick={() => updateEntryStatusMutation.mutate({ id: entry.id, status: 'posted' })} data-testid={`btn-post-${entry.id}`}>
                                <CheckCircle className="h-3 w-3 ml-1" />ترحيل
                              </Button>
                            )}
                            {entry.reconciliationStatus === 'pending' && (
                              <>
                                <Button size="sm" variant="outline" className="text-green-600" onClick={() => updateEntryStatusMutation.mutate({ id: entry.id, reconciliationStatus: 'matched' })} data-testid={`btn-match-${entry.id}`}>
                                  <CheckCircle className="h-3 w-3 ml-1" />مُطابق
                                </Button>
                                <Button size="sm" variant="outline" className="text-red-600" onClick={() => updateEntryStatusMutation.mutate({ id: entry.id, reconciliationStatus: 'discrepancy' })} data-testid={`btn-discrepancy-${entry.id}`}>
                                  <XCircle className="h-3 w-3 ml-1" />فرق
                                </Button>
                              </>
                            )}
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b">
                                <th className="text-right p-2">#</th>
                                <th className="text-right p-2">رمز الحساب</th>
                                <th className="text-right p-2">اسم الحساب</th>
                                <th className="text-right p-2">البيان</th>
                                <th className="text-left p-2">مدين</th>
                                <th className="text-left p-2">دائن</th>
                                <th className="text-right p-2">مركز التكلفة</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(entryDetails.lines || []).map((line: any) => (
                                <tr key={line.id} className="border-b last:border-0">
                                  <td className="p-2">{line.lineNumber}</td>
                                  <td className="p-2 font-mono">{line.accountCode}</td>
                                  <td className="p-2">{line.accountName}</td>
                                  <td className="p-2 text-muted-foreground">{line.description}</td>
                                  <td className="p-2 text-left font-mono">{parseFloat(line.debitAmount || 0) > 0 ? parseFloat(line.debitAmount).toLocaleString('ar-SA') : '-'}</td>
                                  <td className="p-2 text-left font-mono">{parseFloat(line.creditAmount || 0) > 0 ? parseFloat(line.creditAmount).toLocaleString('ar-SA') : '-'}</td>
                                  <td className="p-2">{line.costCenter || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="font-bold border-t-2">
                                <td colSpan={4} className="p-2">الإجمالي</td>
                                <td className="p-2 text-left font-mono">{parseFloat(entryDetails.totalDebit || 0).toLocaleString('ar-SA')}</td>
                                <td className="p-2 text-left font-mono">{parseFloat(entryDetails.totalCredit || 0).toLocaleString('ar-SA')}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciliation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-amber-600" />إنشاء تسوية مالية جديدة</CardTitle>
              <CardDescription>مقارنة بيانات النظام مع الإيداعات الفعلية وتحديد الفروقات</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4 items-end">
                <div className="space-y-2">
                  <Label>من تاريخ</Label>
                  <Input type="date" value={recPeriodFrom} onChange={(e) => setRecPeriodFrom(e.target.value)} data-testid="input-rec-from" />
                </div>
                <div className="space-y-2">
                  <Label>إلى تاريخ</Label>
                  <Input type="date" value={recPeriodTo} onChange={(e) => setRecPeriodTo(e.target.value)} data-testid="input-rec-to" />
                </div>
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <Select value={recBranch} onValueChange={setRecBranch}>
                    <SelectTrigger data-testid="select-rec-branch"><SelectValue placeholder="جميع الفروع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {(branches as any[]).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => generateReconciliationMutation.mutate()} disabled={generateReconciliationMutation.isPending || !recPeriodFrom || !recPeriodTo} data-testid="btn-gen-reconciliation">
                  {generateReconciliationMutation.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <RefreshCw className="h-4 w-4 ml-2" />}
                  إنشاء تسوية
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>سجل التسويات المالية</CardTitle>
              <CardDescription>{reconciliations.length} تسوية</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRec ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : reconciliations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد تسويات بعد</p>
              ) : (
                <div className="space-y-4">
                  {reconciliations.map((rec: any) => (
                    <Card key={rec.id} className="border-2" data-testid={`reconciliation-${rec.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-center">
                          <CardTitle className="text-base">تسوية {rec.periodFrom} إلى {rec.periodTo}</CardTitle>
                          <div className="flex gap-2 items-center">
                            <Badge variant={rec.status === 'approved' ? 'default' : rec.status === 'exported' ? 'default' : 'secondary'}>
                              {recMainStatusLabels[rec.status] || rec.status}
                            </Badge>
                            {rec.status === 'draft' && (
                              <Button size="sm" variant="outline" onClick={() => updateRecStatusMutation.mutate({ id: rec.id, status: 'in_review' })} data-testid={`btn-review-${rec.id}`}>
                                مراجعة
                              </Button>
                            )}
                            {rec.status === 'in_review' && (
                              <Button size="sm" onClick={() => updateRecStatusMutation.mutate({ id: rec.id, status: 'approved' })} data-testid={`btn-approve-rec-${rec.id}`}>
                                <CheckCircle className="h-3 w-3 ml-1" />اعتماد
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-xs text-muted-foreground">إجمالي المبيعات (النظام)</p>
                            <p className="text-lg font-bold text-green-700">{parseFloat(rec.totalSystemSales || 0).toLocaleString('ar-SA')} <span className="text-xs">ر.س</span></p>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-xs text-muted-foreground">الإيداعات الفعلية</p>
                            <p className="text-lg font-bold text-blue-700">{parseFloat(rec.totalActualDeposits || 0).toLocaleString('ar-SA')} <span className="text-xs">ر.س</span></p>
                          </div>
                          <div className={`text-center p-3 rounded-lg ${parseFloat(rec.totalVariance || 0) === 0 ? 'bg-green-50' : parseFloat(rec.totalVariance || 0) > 0 ? 'bg-amber-50' : 'bg-red-50'}`}>
                            <p className="text-xs text-muted-foreground">الفرق</p>
                            <p className={`text-lg font-bold ${parseFloat(rec.totalVariance || 0) === 0 ? 'text-green-700' : parseFloat(rec.totalVariance || 0) > 0 ? 'text-amber-700' : 'text-red-700'}`}>{parseFloat(rec.totalVariance || 0).toLocaleString('ar-SA')} <span className="text-xs">ر.س</span></p>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <p className="text-xs text-muted-foreground">قيمة الهالك</p>
                            <p className="text-lg font-bold text-red-700">{parseFloat(rec.totalWasteValue || 0).toLocaleString('ar-SA')} <span className="text-xs">ر.س</span></p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mt-4">
                          <div className="text-center p-2 border rounded">
                            <p className="text-xs text-muted-foreground">ض.ق.م مُحصّلة</p>
                            <p className="font-semibold">{parseFloat(rec.vatCollected || 0).toLocaleString('ar-SA')}</p>
                          </div>
                          <div className="text-center p-2 border rounded">
                            <p className="text-xs text-muted-foreground">عدد القيود</p>
                            <p className="font-semibold">{rec.entriesCount || 0}</p>
                          </div>
                          <div className="text-center p-2 border rounded">
                            <p className="text-xs text-muted-foreground">مُطابقة</p>
                            <p className="font-semibold text-green-600">{rec.matchedCount || 0}</p>
                          </div>
                          <div className="text-center p-2 border rounded">
                            <p className="text-xs text-muted-foreground">فروقات</p>
                            <p className="font-semibold text-red-600">{rec.discrepancyCount || 0}</p>
                          </div>
                          <div className="text-center p-2 border rounded">
                            <p className="text-xs text-muted-foreground">تاريخ الإنشاء</p>
                            <p className="font-semibold text-sm">{rec.reconciliationDate}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-purple-600" />دليل الحسابات</CardTitle>
              <CardDescription>شجرة الحسابات المحاسبية المعتمدة وفق المعايير السعودية</CardDescription>
            </CardHeader>
            <CardContent>
              {chartAccounts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا توجد حسابات</p>
              ) : (
                <div className="space-y-1">
                  {chartAccounts.map((acc: any) => (
                    <div key={acc.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50 border-b" style={{ paddingRight: `${(acc.level - 1) * 24 + 8}px` }} data-testid={`account-${acc.accountCode}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-muted-foreground w-16">{acc.accountCode}</span>
                        <span className={acc.level === 1 ? 'font-bold' : acc.level === 2 ? 'font-semibold' : ''}>{acc.accountName}</span>
                        {acc.accountNameEn && <span className="text-xs text-muted-foreground">({acc.accountNameEn})</span>}
                      </div>
                      <Badge variant="outline" className={
                        acc.accountType === 'asset' ? 'border-blue-300 text-blue-700' :
                        acc.accountType === 'liability' ? 'border-orange-300 text-orange-700' :
                        acc.accountType === 'equity' ? 'border-purple-300 text-purple-700' :
                        acc.accountType === 'revenue' ? 'border-green-300 text-green-700' :
                        'border-red-300 text-red-700'
                      }>
                        {accountTypeLabels[acc.accountType] || acc.accountType}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="export" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5 text-green-600" />تصدير القيود المحاسبية</CardTitle>
              <CardDescription>تصدير القيود بصيغ متوافقة مع أنظمة المحاسبة المختلفة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 items-end mb-6">
                <div className="space-y-2">
                  <Label>من تاريخ</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} data-testid="input-export-date-from" />
                </div>
                <div className="space-y-2">
                  <Label>إلى تاريخ</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} data-testid="input-export-date-to" />
                </div>
                <div className="space-y-2">
                  <Label>الفرع</Label>
                  <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                    <SelectTrigger data-testid="select-export-branch"><SelectValue placeholder="جميع الفروع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفروع</SelectItem>
                      {(branches as any[]).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="border-2 border-green-200 hover:border-green-400 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-5 w-5 text-green-600" />قيود (Qoyod)</CardTitle>
                    <CardDescription>تصدير بصيغة CSV متوافقة مع نظام قيود المحاسبي</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => exportCSV('qoyod')} className="w-full bg-green-600 hover:bg-green-700" size="sm" data-testid="btn-export-qoyod">
                      <Download className="h-4 w-4 ml-2" />تصدير لقيود
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-2 border-red-200 hover:border-red-400 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-5 w-5 text-red-600" />Zoho Books</CardTitle>
                    <CardDescription>تصدير بصيغة CSV متوافقة مع نظام زوهو المحاسبي</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => exportCSV('zoho')} variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-50" size="sm" data-testid="btn-export-zoho-csv">
                      <Download className="h-4 w-4 ml-2" />تصدير لزوهو
                    </Button>
                  </CardContent>
                </Card>
                <Card className="border-2 border-blue-200 hover:border-blue-400 transition-colors">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-blue-600" />CSV عام</CardTitle>
                    <CardDescription>تصدير بصيغة CSV عامة لأي نظام محاسبي</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => exportCSV('general')} variant="outline" className="w-full" size="sm" data-testid="btn-export-general-csv">
                      <Download className="h-4 w-4 ml-2" />تصدير CSV
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>تصدير تقارير إضافية</CardTitle>
              <CardDescription>تصدير تقارير المخزون والأصول والمشاريع</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2"><Calculator className="h-4 w-4 text-blue-600" />تقييم المخزون</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => inventoryValuationMutation.mutate(selectedBranch === "all" ? undefined : selectedBranch || undefined)} disabled={inventoryValuationMutation.isPending} className="w-full" size="sm" data-testid="btn-export-valuation">
                      <Download className="h-4 w-4 ml-2" />تصدير JSON
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>سجل التصديرات</CardTitle>
            </CardHeader>
            <CardContent>
              {exports.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">لا توجد تصديرات بعد</p>
              ) : (
                <div className="space-y-2">
                  {exports.slice(0, 10).map((exp) => (
                    <div key={exp.id} className="flex items-center justify-between p-3 rounded-lg border" data-testid={`export-row-${exp.id}`}>
                      <div className="flex items-center gap-3">
                        <Badge variant={exp.status === 'synced' ? 'default' : 'secondary'}>
                          {exp.status === 'synced' ? 'تم المزامنة' : 'مكتمل'}
                        </Badge>
                        <span className="font-medium">{exp.exportType === 'inventory_valuation' ? 'تقييم المخزون' : exp.exportType === 'asset_movements' ? 'حركة الأصول' : exp.exportType === 'project_costs' ? 'تكاليف المشاريع' : exp.exportType}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{new Date(exp.createdAt).toLocaleDateString('en-GB')}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-green-600" />قيود المحاسبي</CardTitle>
                <CardDescription>نظام المحاسبة السحابي السعودي</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatusBadge configured={qoyodSettings?.configured || false} isActive={qoyodSettings?.isActive} />
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>مفتاح API</Label>
                    <SecureInput value={qoyodApiKey} onChange={setQoyodApiKey} placeholder="qoyod_api_xxxxxxxx" testId="input-qoyod-key" />
                  </div>
                  <div className="space-y-2">
                    <Label>رابط API</Label>
                    <Input value={qoyodApiUrl} onChange={(e) => setQoyodApiUrl(e.target.value)} placeholder="https://api.qoyod.com/api/2.0" data-testid="input-qoyod-url" dir="ltr" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    احصل على المفتاح من <a href="https://www.qoyod.com" target="_blank" rel="noreferrer" className="underline text-primary">لوحة تحكم قيود</a> &gt; إعدادات &gt; API
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={() => saveQoyod.mutate({ name: "قيود", config: { apiKey: qoyodApiKey, apiUrl: qoyodApiUrl } })} disabled={saveQoyod.isPending || !qoyodApiKey} data-testid="btn-save-qoyod">
                    {saveQoyod.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                    حفظ
                  </Button>
                  <Button variant="outline" onClick={() => testQoyod.mutate()} disabled={testQoyod.isPending || !qoyodSettings?.configured} data-testid="btn-test-qoyod">
                    {testQoyod.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5 text-red-600" />Zoho Books</CardTitle>
                <CardDescription>نظام زوهو المحاسبي</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StatusBadge configured={zohoSettings?.configured || false} isActive={zohoSettings?.isActive} />
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>معرّف العميل (Client ID)</Label>
                    <Input value={zohoClientId} onChange={(e) => setZohoClientId(e.target.value)} placeholder="1000.xxxxxxxx" data-testid="input-zoho-client-id" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>المفتاح السري (Client Secret)</Label>
                    <SecureInput value={zohoClientSecret} onChange={setZohoClientSecret} testId="input-zoho-secret" />
                  </div>
                  <div className="space-y-2">
                    <Label>معرّف المنظمة (Organization ID)</Label>
                    <Input value={zohoOrgId} onChange={(e) => setZohoOrgId(e.target.value)} placeholder="xxxxxxxx" data-testid="input-zoho-org-id" dir="ltr" />
                  </div>
                  <div className="space-y-2">
                    <Label>المنطقة</Label>
                    <Select value={zohoRegion} onValueChange={setZohoRegion}>
                      <SelectTrigger data-testid="select-zoho-region"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sa">السعودية (sa)</SelectItem>
                        <SelectItem value="com">عالمي (com)</SelectItem>
                        <SelectItem value="eu">أوروبا (eu)</SelectItem>
                        <SelectItem value="in">الهند (in)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    سجّل التطبيق من <a href="https://api-console.zoho.sa" target="_blank" rel="noreferrer" className="underline text-primary">Zoho API Console</a>
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => saveZoho.mutate({ name: "Zoho Books", config: { clientId: zohoClientId, clientSecret: zohoClientSecret, organizationId: zohoOrgId, region: zohoRegion } })} disabled={saveZoho.isPending || !zohoClientId} data-testid="btn-save-zoho">
                    {saveZoho.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                    حفظ
                  </Button>
                  <Button variant="outline" onClick={() => testZoho.mutate()} disabled={testZoho.isPending || !zohoSettings?.configured} data-testid="btn-test-zoho">
                    {testZoho.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ERPSection() {
  const { data: sapSettings } = useIntegrationSettings('sap');
  const { data: odooSettings } = useIntegrationSettings('odoo');
  const saveSap = useSaveIntegration('sap');
  const saveOdoo = useSaveIntegration('odoo');
  const testSap = useTestIntegration('sap');
  const testOdoo = useTestIntegration('odoo');

  const [sapUrl, setSapUrl] = useState("");
  const [sapCompanyDb, setSapCompanyDb] = useState("");
  const [sapUser, setSapUser] = useState("");
  const [sapPass, setSapPass] = useState("");

  const [odooUrl, setOdooUrl] = useState("");
  const [odooDb, setOdooDb] = useState("");
  const [odooUser, setOdooUser] = useState("");
  const [odooApiKey, setOdooApiKey] = useState("");

  useEffect(() => {
    if (sapSettings?.config) {
      setSapUrl(sapSettings.config.serviceUrl || "");
      setSapCompanyDb(sapSettings.config.companyDB || "");
      setSapUser(sapSettings.config.username || "");
      setSapPass(sapSettings.config.password || "");
    }
  }, [sapSettings]);

  useEffect(() => {
    if (odooSettings?.config) {
      setOdooUrl(odooSettings.config.serverUrl || "");
      setOdooDb(odooSettings.config.database || "");
      setOdooUser(odooSettings.config.username || "");
      setOdooApiKey(odooSettings.config.apiKey || "");
    }
  }, [odooSettings]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-blue-600" />SAP Business One</CardTitle>
            <CardDescription>نظام تخطيط موارد المؤسسة</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={sapSettings?.configured || false} isActive={sapSettings?.isActive} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>رابط الخدمة (Service Layer URL)</Label>
                <Input value={sapUrl} onChange={(e) => setSapUrl(e.target.value)} placeholder="https://sap-server:50000/b1s/v1" data-testid="input-sap-url" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>قاعدة بيانات الشركة (Company DB)</Label>
                <Input value={sapCompanyDb} onChange={(e) => setSapCompanyDb(e.target.value)} placeholder="BUTTER_BAKERY" data-testid="input-sap-db" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>اسم المستخدم</Label>
                <Input value={sapUser} onChange={(e) => setSapUser(e.target.value)} placeholder="manager" data-testid="input-sap-user" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <SecureInput value={sapPass} onChange={setSapPass} testId="input-sap-pass" />
              </div>
              <p className="text-xs text-muted-foreground">تأكد من تفعيل Service Layer على خادم SAP Business One</p>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => saveSap.mutate({ name: "SAP Business One", config: { serviceUrl: sapUrl, companyDB: sapCompanyDb, username: sapUser, password: sapPass } })} disabled={saveSap.isPending || !sapUrl} data-testid="btn-save-sap">
                {saveSap.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ
              </Button>
              <Button variant="outline" onClick={() => testSap.mutate()} disabled={testSap.isPending || !sapSettings?.configured} data-testid="btn-test-sap">
                {testSap.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-purple-600" />Odoo</CardTitle>
            <CardDescription>نظام ERP مفتوح المصدر</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusBadge configured={odooSettings?.configured || false} isActive={odooSettings?.isActive} />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>رابط الخادم (Server URL)</Label>
                <Input value={odooUrl} onChange={(e) => setOdooUrl(e.target.value)} placeholder="https://mycompany.odoo.com" data-testid="input-odoo-url" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>اسم قاعدة البيانات</Label>
                <Input value={odooDb} onChange={(e) => setOdooDb(e.target.value)} placeholder="butter_bakery" data-testid="input-odoo-db" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني / اسم المستخدم</Label>
                <Input value={odooUser} onChange={(e) => setOdooUser(e.target.value)} placeholder="admin@butterbakery.sa" data-testid="input-odoo-user" dir="ltr" />
              </div>
              <div className="space-y-2">
                <Label>مفتاح API</Label>
                <SecureInput value={odooApiKey} onChange={setOdooApiKey} testId="input-odoo-key" />
                <p className="text-xs text-muted-foreground">من الإعدادات &gt; المستخدمون &gt; مفاتيح API</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => saveOdoo.mutate({ name: "Odoo", config: { serverUrl: odooUrl, database: odooDb, username: odooUser, apiKey: odooApiKey } })} disabled={saveOdoo.isPending || !odooUrl} data-testid="btn-save-odoo">
                {saveOdoo.isPending ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : <Save className="h-4 w-4 ml-2" />}
                حفظ
              </Button>
              <Button variant="outline" onClick={() => testOdoo.mutate()} disabled={testOdoo.isPending || !odooSettings?.configured} data-testid="btn-test-odoo">
                {testOdoo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />استيراد البيانات</CardTitle>
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
              <p className="text-xs text-muted-foreground">استخدم صفحة إدارة المخزون لاستيراد البيانات من ملفات Excel</p>
            </div>
            <div className="p-4 border rounded-lg hover:border-primary transition-colors cursor-pointer">
              <div className="flex items-center gap-3 mb-2">
                <Link2 className="h-8 w-8 text-blue-600" />
                <div>
                  <h3 className="font-medium">استيراد من API</h3>
                  <p className="text-sm text-muted-foreground">ربط مع أنظمة ERP</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">ربط مباشر مع أنظمة تخطيط الموارد بعد إعداد التكامل أعلاه</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
