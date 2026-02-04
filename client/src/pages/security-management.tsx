import { Layout } from "@/components/layout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { SettingsBreadcrumb } from "@/components/settings-breadcrumb";
import { useState } from "react";
import { 
  Loader2, 
  Shield, 
  Key, 
  Smartphone, 
  Globe, 
  Clock, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  XCircle,
  LogOut,
  Monitor,
  FileText,
  Copy,
  Trash2,
  Eye,
  EyeOff,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

interface UserSecuritySettings {
  id?: number;
  userId: string;
  twoFactorEnabled: boolean;
  ipWhitelist: string[] | null;
  ipRestrictionEnabled: boolean;
  sessionTimeout: number;
  maxConcurrentSessions: number;
  passwordExpiryDays: number;
  forcePasswordChange: boolean;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  lastLoginDevice: string | null;
}

interface UserSession {
  id: number;
  sessionId: string;
  userId: string;
  deviceInfo: { browser: string; os: string; device: string } | null;
  ipAddress: string | null;
  isActive: boolean;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
}

interface SecurityAlert {
  id: number;
  userId: string;
  violationType: string;
  severity: string;
  description: string;
  ipAddress: string | null;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  resolutionNotes: string | null;
  createdAt: string;
}

interface RoleTemplate {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  permissions: Array<{ module: string; actions: string[] }>;
  departmentId: number | null;
  isSystemDefault: boolean;
  createdAt: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

const VIOLATION_LABELS: Record<string, string> = {
  failed_login: "محاولة تسجيل دخول فاشلة",
  unauthorized_access: "محاولة وصول غير مصرح",
  ip_blocked: "IP محظور",
  session_hijack: "اختراق جلسة مشتبه",
  brute_force: "هجوم تخمين كلمة المرور",
  permission_denied: "صلاحية مرفوضة",
};

export default function SecurityManagementPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("settings");
  const [showIpDialog, setShowIpDialog] = useState(false);
  const [newIp, setNewIp] = useState("");
  const [resolveAlertId, setResolveAlertId] = useState<number | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");

  const { data: securitySettings, isLoading: loadingSettings } = useQuery<UserSecuritySettings>({
    queryKey: ["/api/security/users", user?.id, "settings"],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/security/users/${user.id}/settings`, { credentials: "include" });
      if (!res.ok) throw new Error("فشل في جلب إعدادات الأمان");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const { data: sessions, isLoading: loadingSessions } = useQuery<UserSession[]>({
    queryKey: ["/api/security/sessions"],
    queryFn: async () => {
      const res = await fetch("/api/security/sessions", { credentials: "include" });
      if (!res.ok) throw new Error("فشل في جلب الجلسات");
      return res.json();
    },
  });

  const { data: alerts, isLoading: loadingAlerts } = useQuery<SecurityAlert[]>({
    queryKey: ["/api/security/alerts"],
    queryFn: async () => {
      const res = await fetch("/api/security/alerts", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: roleTemplates, isLoading: loadingTemplates } = useQuery<RoleTemplate[]>({
    queryKey: ["/api/rbac/role-templates"],
    queryFn: async () => {
      const res = await fetch("/api/rbac/role-templates", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<UserSecuritySettings>) => {
      const res = await fetch(`/api/security/users/${user?.id}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("فشل في تحديث الإعدادات");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/users", user?.id, "settings"] });
      toast({ title: "تم تحديث الإعدادات بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في تحديث الإعدادات", variant: "destructive" });
    },
  });

  const invalidateSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/security/sessions/${sessionId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("فشل في إنهاء الجلسة");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/sessions"] });
      toast({ title: "تم إنهاء الجلسة بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنهاء الجلسة", variant: "destructive" });
    },
  });

  const invalidateAllSessionsMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/security/users/${user?.id}/sessions`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("فشل في إنهاء الجلسات");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/sessions"] });
      toast({ title: "تم إنهاء جميع الجلسات بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في إنهاء الجلسات", variant: "destructive" });
    },
  });

  const resolveAlertMutation = useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes: string }) => {
      const res = await fetch(`/api/security/alerts/${id}/resolve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) throw new Error("فشل في حل التنبيه");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/security/alerts"] });
      setResolveAlertId(null);
      setResolutionNotes("");
      toast({ title: "تم حل التنبيه بنجاح" });
    },
    onError: () => {
      toast({ title: "فشل في حل التنبيه", variant: "destructive" });
    },
  });

  const handleAddIp = () => {
    if (!newIp.trim()) return;
    const currentList = securitySettings?.ipWhitelist || [];
    if (currentList.includes(newIp.trim())) {
      toast({ title: "هذا العنوان موجود مسبقاً", variant: "destructive" });
      return;
    }
    updateSettingsMutation.mutate({ ipWhitelist: [...currentList, newIp.trim()] });
    setNewIp("");
    setShowIpDialog(false);
  };

  const handleRemoveIp = (ip: string) => {
    const currentList = securitySettings?.ipWhitelist || [];
    updateSettingsMutation.mutate({ ipWhitelist: currentList.filter(i => i !== ip) });
  };

  if (!user) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-xl text-muted-foreground">يرجى تسجيل الدخول للوصول لإعدادات الأمان</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 lg:p-10 max-w-6xl mx-auto space-y-4" dir="rtl">
        <SettingsBreadcrumb
          currentPage="إدارة الأمان"
          currentIcon={Shield}
        />
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 sm:mb-6">
          <Link href="/settings">
            <Button variant="ghost" size="icon" className="h-11 w-11 sm:h-8 sm:w-8" data-testid="btn-back">
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-amber-600" />
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold" data-testid="text-security-page-title">إدارة الأمان</h1>
            <p className="text-sm sm:text-base text-muted-foreground" data-testid="text-security-page-description">إدارة إعدادات الأمان والجلسات والتنبيهات</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-4 sm:mb-6 h-auto">
            <TabsTrigger value="settings" className="flex items-center gap-1 sm:gap-2 h-11 sm:h-10 text-xs sm:text-sm" data-testid="tab-security-settings">
              <Key className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">الإعدادات</span>
              <span className="sm:hidden">إعدادات</span>
            </TabsTrigger>
            <TabsTrigger value="sessions" className="flex items-center gap-1 sm:gap-2 h-11 sm:h-10 text-xs sm:text-sm" data-testid="tab-security-sessions">
              <Monitor className="h-3 w-3 sm:h-4 sm:w-4" />
              الجلسات
            </TabsTrigger>
            <TabsTrigger value="alerts" className="flex items-center gap-1 sm:gap-2 h-11 sm:h-10 text-xs sm:text-sm" data-testid="tab-security-alerts">
              <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">التنبيهات</span>
              <span className="sm:hidden">تنبيه</span>
              {Array.isArray(alerts) && alerts.filter(a => !a.isResolved).length > 0 && (
                <Badge variant="destructive" className="mr-1 text-[10px] sm:text-xs" data-testid="badge-unresolved-alerts-count">
                  {alerts.filter(a => !a.isResolved).length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="templates" className="flex items-center gap-1 sm:gap-2 h-11 sm:h-10 text-xs sm:text-sm" data-testid="tab-role-templates">
              <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">قوالب الأدوار</span>
              <span className="sm:hidden">قوالب</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            {loadingSettings ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="grid gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smartphone className="h-5 w-5" />
                      المصادقة الثنائية (2FA)
                    </CardTitle>
                    <CardDescription>
                      تفعيل المصادقة الثنائية لحماية إضافية عند تسجيل الدخول
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">المصادقة الثنائية</p>
                        <p className="text-sm text-muted-foreground">
                          {securitySettings?.twoFactorEnabled ? "مفعّلة" : "غير مفعّلة"}
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings?.twoFactorEnabled || false}
                        onCheckedChange={(checked) => 
                          updateSettingsMutation.mutate({ twoFactorEnabled: checked })
                        }
                        disabled={updateSettingsMutation.isPending}
                        data-testid="switch-two-factor"
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5" />
                      قيود عنوان IP
                    </CardTitle>
                    <CardDescription>
                      تحديد عناوين IP المسموح لها بالوصول للحساب
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">تفعيل قيود IP</p>
                        <p className="text-sm text-muted-foreground">
                          السماح فقط لعناوين IP المحددة
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings?.ipRestrictionEnabled || false}
                        onCheckedChange={(checked) => 
                          updateSettingsMutation.mutate({ ipRestrictionEnabled: checked })
                        }
                        disabled={updateSettingsMutation.isPending}
                        data-testid="switch-ip-restriction"
                      />
                    </div>

                    {securitySettings?.ipRestrictionEnabled && (
                      <div className="border rounded-lg p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                          <p className="font-medium text-sm sm:text-base">قائمة IP المسموحة</p>
                          <Button size="sm" className="h-11 sm:h-9 w-full sm:w-auto" onClick={() => setShowIpDialog(true)} data-testid="button-add-ip">
                            إضافة IP
                          </Button>
                        </div>
                        {(securitySettings?.ipWhitelist || []).length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-ip-whitelist">
                            لم تتم إضافة أي عناوين IP بعد
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {securitySettings?.ipWhitelist?.map((ip) => (
                              <Badge key={ip} variant="secondary" className="flex items-center gap-1" data-testid={`badge-ip-${ip.replace(/\./g, '-')}`}>
                                {ip}
                                <button
                                  onClick={() => handleRemoveIp(ip)}
                                  className="mr-1 hover:text-destructive"
                                  data-testid={`button-remove-ip-${ip.replace(/\./g, '-')}`}
                                >
                                  <XCircle className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      إعدادات الجلسة
                    </CardTitle>
                    <CardDescription>
                      التحكم في مهلة الجلسة وعدد الجلسات المتزامنة
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm sm:text-base">مهلة الجلسة (بالدقائق)</Label>
                        <Input
                          type="number"
                          min={5}
                          max={1440}
                          value={securitySettings?.sessionTimeout || 480}
                          onChange={(e) => 
                            updateSettingsMutation.mutate({ sessionTimeout: parseInt(e.target.value) || 480 })
                          }
                          disabled={updateSettingsMutation.isPending}
                          className="h-11 sm:h-10"
                          data-testid="input-session-timeout"
                        />
                        <p className="text-xs text-muted-foreground">
                          من 5 دقائق إلى 24 ساعة (1440 دقيقة)
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm sm:text-base">الحد الأقصى للجلسات المتزامنة</Label>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={securitySettings?.maxConcurrentSessions || 3}
                          onChange={(e) => 
                            updateSettingsMutation.mutate({ maxConcurrentSessions: parseInt(e.target.value) || 3 })
                          }
                          disabled={updateSettingsMutation.isPending}
                          className="h-11 sm:h-10"
                          data-testid="input-max-sessions"
                        />
                        <p className="text-xs text-muted-foreground">
                          من 1 إلى 10 جلسات
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Key className="h-5 w-5" />
                      سياسة كلمة المرور
                    </CardTitle>
                    <CardDescription>
                      إعدادات صلاحية كلمة المرور
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm sm:text-base">صلاحية كلمة المرور (بالأيام)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        value={securitySettings?.passwordExpiryDays || 90}
                        onChange={(e) => 
                          updateSettingsMutation.mutate({ passwordExpiryDays: parseInt(e.target.value) || 90 })
                        }
                        disabled={updateSettingsMutation.isPending}
                        className="h-11 sm:h-10"
                        data-testid="input-password-expiry"
                      />
                      <p className="text-xs text-muted-foreground">
                        0 = لا تنتهي صلاحيتها، الحد الأقصى 365 يوم
                      </p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">إجبار تغيير كلمة المرور</p>
                        <p className="text-sm text-muted-foreground">
                          يجب على المستخدم تغيير كلمة المرور عند تسجيل الدخول التالي
                        </p>
                      </div>
                      <Switch
                        checked={securitySettings?.forcePasswordChange || false}
                        onCheckedChange={(checked) => 
                          updateSettingsMutation.mutate({ forcePasswordChange: checked })
                        }
                        disabled={updateSettingsMutation.isPending}
                        data-testid="switch-force-password-change"
                      />
                    </div>
                  </CardContent>
                </Card>

                {securitySettings?.lastLoginAt && (
                  <Card data-testid="card-last-login">
                    <CardHeader>
                      <CardTitle>معلومات آخر تسجيل دخول</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">التاريخ:</span>
                          <span data-testid="text-last-login-date">{securitySettings.lastLoginAt ? new Date(securitySettings.lastLoginAt).toLocaleString("en-GB") : "-"}</span>
                        </div>
                        {securitySettings.lastLoginIp && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">عنوان IP:</span>
                            <span data-testid="text-last-login-ip">{securitySettings.lastLoginIp}</span>
                          </div>
                        )}
                        {securitySettings.lastLoginDevice && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">الجهاز:</span>
                            <span data-testid="text-last-login-device">{securitySettings.lastLoginDevice}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sessions">
            <Card>
              <CardHeader className="p-3 sm:p-4 md:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base sm:text-lg">الجلسات النشطة</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      عرض وإدارة جميع الجلسات النشطة لحسابك
                    </CardDescription>
                  </div>
                  {Array.isArray(sessions) && sessions.length > 1 && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      className="h-11 sm:h-9 w-full sm:w-auto"
                      onClick={() => invalidateAllSessionsMutation.mutate()}
                      disabled={invalidateAllSessionsMutation.isPending}
                      data-testid="button-invalidate-all-sessions"
                    >
                      <LogOut className="h-4 w-4 ml-2" />
                      إنهاء جميع الجلسات
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {loadingSessions ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : !Array.isArray(sessions) || sessions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8" data-testid="text-no-sessions">
                    لا توجد جلسات نشطة
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الجهاز</TableHead>
                        <TableHead>عنوان IP</TableHead>
                        <TableHead>آخر نشاط</TableHead>
                        <TableHead>تنتهي في</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((session) => (
                        <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Monitor className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="font-medium" data-testid={`text-session-browser-${session.id}`}>
                                  {session.deviceInfo?.browser || "متصفح غير معروف"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {session.deviceInfo?.os || "نظام غير معروف"}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell data-testid={`text-session-ip-${session.id}`}>{session.ipAddress || "-"}</TableCell>
                          <TableCell>
                            {session.lastActivityAt ? formatDistanceToNow(new Date(session.lastActivityAt), { 
                              addSuffix: true, 
                              locale: ar 
                            }) : "-"}
                          </TableCell>
                          <TableCell>
                            {session.expiresAt ? new Date(session.expiresAt).toLocaleString("en-GB") : "-"}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => invalidateSessionMutation.mutate(session.sessionId)}
                              disabled={invalidateSessionMutation.isPending}
                              data-testid={`button-invalidate-session-${session.id}`}
                            >
                              <LogOut className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="alerts">
            <Card>
              <CardHeader>
                <CardTitle>تنبيهات الأمان</CardTitle>
                <CardDescription>
                  مراجعة ومعالجة التنبيهات الأمنية
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAlerts ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : !Array.isArray(alerts) || alerts.length === 0 ? (
                  <div className="text-center py-12" data-testid="container-no-alerts">
                    <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                    <p className="text-xl font-medium" data-testid="text-no-alerts-title">لا توجد تنبيهات أمنية</p>
                    <p className="text-muted-foreground" data-testid="text-no-alerts-description">حسابك آمن ولا توجد مشاكل للمراجعة</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>النوع</TableHead>
                        <TableHead>الخطورة</TableHead>
                        <TableHead>الوصف</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((alert) => (
                        <TableRow key={alert.id} data-testid={`row-alert-${alert.id}`}>
                          <TableCell data-testid={`text-alert-type-${alert.id}`}>
                            {VIOLATION_LABELS[alert.violationType] || alert.violationType}
                          </TableCell>
                          <TableCell>
                            <Badge className={SEVERITY_COLORS[alert.severity] || "bg-gray-100"} data-testid={`badge-alert-severity-${alert.id}`}>
                              {alert.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate" data-testid={`text-alert-description-${alert.id}`}>
                            {alert.description}
                          </TableCell>
                          <TableCell>
                            {alert.createdAt ? new Date(alert.createdAt).toLocaleString("en-GB") : "-"}
                          </TableCell>
                          <TableCell>
                            {alert.isResolved ? (
                              <Badge variant="outline" className="bg-green-50" data-testid={`badge-alert-resolved-${alert.id}`}>
                                <CheckCircle className="h-3 w-3 ml-1" />
                                تم الحل
                              </Badge>
                            ) : (
                              <Badge variant="destructive" data-testid={`badge-alert-pending-${alert.id}`}>
                                <AlertTriangle className="h-3 w-3 ml-1" />
                                قيد المراجعة
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {!alert.isResolved && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setResolveAlertId(alert.id)}
                                data-testid={`button-resolve-alert-${alert.id}`}
                              >
                                حل
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>قوالب الأدوار</CardTitle>
                <CardDescription>
                  قوالب جاهزة لتعيين الصلاحيات بسرعة
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : !Array.isArray(roleTemplates) || roleTemplates.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8" data-testid="text-no-templates">
                    لا توجد قوالب أدوار متاحة
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {roleTemplates.map((template) => (
                      <Card key={template.id} className="border-2" data-testid={`card-template-${template.id}`}>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Shield className="h-5 w-5 text-amber-600" />
                            <span data-testid={`text-template-name-${template.id}`}>{template.name}</span>
                            {template.isSystemDefault && (
                              <Badge variant="secondary" className="mr-auto" data-testid={`badge-template-default-${template.id}`}>افتراضي</Badge>
                            )}
                          </CardTitle>
                          {template.description && (
                            <CardDescription data-testid={`text-template-description-${template.id}`}>{template.description}</CardDescription>
                          )}
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            <p className="text-sm font-medium">الصلاحيات:</p>
                            <div className="flex flex-wrap gap-1">
                              {template.permissions.slice(0, 5).map((perm, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs" data-testid={`badge-template-perm-${template.id}-${idx}`}>
                                  {perm.module}
                                </Badge>
                              ))}
                              {template.permissions.length > 5 && (
                                <Badge variant="outline" className="text-xs">
                                  +{template.permissions.length - 5}
                                </Badge>
                              )}
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
        </Tabs>

        <Dialog open={showIpDialog} onOpenChange={setShowIpDialog}>
          <DialogContent data-testid="dialog-add-ip">
            <DialogHeader>
              <DialogTitle>إضافة عنوان IP</DialogTitle>
              <DialogDescription>
                أدخل عنوان IP المسموح له بالوصول للحساب
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>عنوان IP</Label>
                <Input
                  placeholder="مثال: 192.168.1.100"
                  value={newIp}
                  onChange={(e) => setNewIp(e.target.value)}
                  data-testid="input-new-ip"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowIpDialog(false)} data-testid="button-cancel-add-ip">
                إلغاء
              </Button>
              <Button onClick={handleAddIp} disabled={!newIp.trim()} data-testid="button-confirm-add-ip">
                إضافة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={resolveAlertId !== null} onOpenChange={() => setResolveAlertId(null)}>
          <DialogContent data-testid="dialog-resolve-alert">
            <DialogHeader>
              <DialogTitle>حل التنبيه الأمني</DialogTitle>
              <DialogDescription>
                أدخل ملاحظات حول كيفية حل هذا التنبيه
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>ملاحظات الحل</Label>
                <Input
                  placeholder="وصف الإجراء المتخذ..."
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  data-testid="input-resolution-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveAlertId(null)} data-testid="button-cancel-resolve-alert">
                إلغاء
              </Button>
              <Button 
                onClick={() => resolveAlertId && resolveAlertMutation.mutate({ 
                  id: resolveAlertId, 
                  notes: resolutionNotes 
                })}
                disabled={resolveAlertMutation.isPending}
                data-testid="button-confirm-resolve-alert"
              >
                {resolveAlertMutation.isPending && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
                حل التنبيه
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
