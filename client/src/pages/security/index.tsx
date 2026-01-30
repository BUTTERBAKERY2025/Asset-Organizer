import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Shield, AlertTriangle, Users, Activity, 
  FileText, Eye, Clock, CheckCircle, XCircle,
  Search, Download, RefreshCw
} from "lucide-react";

interface UserPermissionReport {
  summary: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    multiBranchUsers: number;
    usersWithNoPermissions: number;
  };
  users: Array<{
    user: {
      id: string;
      username: string;
      fullName: string;
      email: string;
      role: string;
      jobTitle?: string;
      isActive: string;
    };
    defaultBranch: { id: string; name: string } | null;
    branchAccess: Array<{ branchId: string; branchName: string; isDefault: boolean }>;
    permissions: Record<string, string[]>;
    permissionsCount: number;
    modulesWithAccess: string[];
    hasFullAccess: boolean;
    hasMultiBranchAccess: boolean;
  }>;
}

interface SecurityAlerts {
  summary: {
    total: number;
    unresolved: number;
    bySeverity: { critical: number; high: number; medium: number; low: number };
    byType: Record<string, number>;
  };
  alerts: Array<{
    id: number;
    alertType: string;
    severity: string;
    userId?: string;
    userName?: string;
    module?: string;
    action?: string;
    details?: string;
    isResolved: boolean;
    createdAt: string;
  }>;
}

interface AuditLogResponse {
  logs: Array<{
    id: number;
    module: string;
    moduleLabel: string;
    action: string;
    actionLabel: string;
    entityName?: string;
    description?: string;
    userName?: string;
    ipAddress?: string;
    createdAt: string;
  }>;
  pagination: { page: number; limit: number; total: number; totalPages: number };
  filters: { modules: string[]; actions: string[] };
}

interface SecurityStats {
  overview: {
    totalLogs: number;
    todayLogs: number;
    securityAlerts: number;
    failedLogins: number;
    permissionDenied: number;
    pendingAlerts: number;
  };
  activeUsers: Array<{ userId: string; userName: string; actionsCount: number }>;
  actionsByModule: Array<{ module: string; moduleLabel: string; count: number }>;
}

export default function SecurityPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [searchTerm, setSearchTerm] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [auditPage, setAuditPage] = useState(1);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useQuery<SecurityStats>({
    queryKey: ["/api/security/stats"],
  });

  const { data: permissionsReport, isLoading: permissionsLoading } = useQuery<UserPermissionReport>({
    queryKey: ["/api/security/user-permissions-report"],
  });

  const { data: alerts, isLoading: alertsLoading, refetch: refetchAlerts } = useQuery<SecurityAlerts>({
    queryKey: ["/api/security/alerts"],
  });

  const { data: auditLog, isLoading: auditLoading, refetch: refetchAudit } = useQuery<AuditLogResponse>({
    queryKey: ["/api/security/audit-log", { page: auditPage, module: moduleFilter !== 'all' ? moduleFilter : undefined }],
  });

  const getSeverityBadge = (severity: string) => {
    const colors: Record<string, string> = {
      critical: "bg-red-500",
      high: "bg-orange-500",
      medium: "bg-yellow-500",
      low: "bg-blue-500",
    };
    return <Badge className={colors[severity] || "bg-gray-500"}>{severity}</Badge>;
  };

  const getAlertTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      unauthorized_access: "وصول غير مصرح",
      permission_denied: "رفض صلاحية",
      branch_violation: "انتهاك فرع",
      rate_limit: "تجاوز الحد",
      suspicious_activity: "نشاط مشبوه",
    };
    return labels[type] || type;
  };

  const filteredUsers = permissionsReport?.users.filter(u => 
    u.user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.user.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl" data-testid="security-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Shield className="h-8 w-8" />
            الأمان والتدقيق
          </h1>
          <p className="text-muted-foreground mt-1" data-testid="text-page-description">
            مراقبة الأمان، تقارير الصلاحيات، وسجل التدقيق
          </p>
        </div>
        <Button onClick={() => { refetchStats(); refetchAlerts(); refetchAudit(); }} variant="outline" data-testid="button-refresh-all">
          <RefreshCw className="h-4 w-4 ml-2" />
          تحديث
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} data-testid="security-tabs">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2" data-testid="tab-overview">
            <Activity className="h-4 w-4" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-2" data-testid="tab-permissions">
            <Users className="h-4 w-4" />
            صلاحيات المستخدمين
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-2" data-testid="tab-alerts">
            <AlertTriangle className="h-4 w-4" />
            التنبيهات
            {stats?.overview.pendingAlerts ? (
              <Badge variant="destructive" className="mr-2" data-testid="badge-pending-alerts">{stats.overview.pendingAlerts}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2" data-testid="tab-audit">
            <FileText className="h-4 w-4" />
            سجل التدقيق
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6" data-testid="content-overview">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card data-testid="card-total-logs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي السجلات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" data-testid="stat-total-logs">{stats?.overview.totalLogs?.toLocaleString('en-US') || 0}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-today-logs">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">سجلات اليوم</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600" data-testid="stat-today-logs">{stats?.overview.todayLogs?.toLocaleString('en-US') || 0}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-security-alerts">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">تنبيهات أمنية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600" data-testid="stat-security-alerts">{stats?.overview.securityAlerts?.toLocaleString('en-US') || 0}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-failed-logins">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">محاولات دخول فاشلة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600" data-testid="stat-failed-logins">{stats?.overview.failedLogins?.toLocaleString('en-US') || 0}</div>
              </CardContent>
            </Card>
            <Card data-testid="card-permission-denied">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">صلاحيات مرفوضة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{stats?.overview.permissionDenied?.toLocaleString('en-US') || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">تنبيهات معلقة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">{stats?.overview.pendingAlerts?.toLocaleString('en-US') || 0}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>أكثر المستخدمين نشاطاً (آخر 7 أيام)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المستخدم</TableHead>
                      <TableHead>عدد العمليات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.activeUsers.slice(0, 5).map((u, i) => (
                      <TableRow key={i}>
                        <TableCell>{u.userName}</TableCell>
                        <TableCell>{u.actionsCount.toLocaleString('en-US')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>العمليات حسب الوحدة (آخر 7 أيام)</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الوحدة</TableHead>
                      <TableHead>عدد العمليات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.actionsByModule.slice(0, 5).map((m, i) => (
                      <TableRow key={i}>
                        <TableCell>{m.moduleLabel}</TableCell>
                        <TableCell>{m.count.toLocaleString('en-US')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>تقرير صلاحيات المستخدمين</CardTitle>
              <CardDescription>
                عرض تفصيلي لصلاحيات كل مستخدم والفروع المتاحة له
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-4 mb-6">
                <Card className="bg-blue-50">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {permissionsReport?.summary.totalUsers?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">إجمالي المستخدمين</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {permissionsReport?.summary.activeUsers?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">مستخدمين نشطين</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {permissionsReport?.summary.adminUsers?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">مديرين</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {permissionsReport?.summary.multiBranchUsers?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">متعدد الفروع</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50">
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {permissionsReport?.summary.usersWithNoPermissions?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">بدون صلاحيات</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث عن مستخدم..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>

              <div className="space-y-4">
                {permissionsLoading ? (
                  <div className="text-center py-8">جاري التحميل...</div>
                ) : filteredUsers.map((userReport) => (
                  <Card key={userReport.user.id} className="border">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-base">{userReport.user.fullName}</CardTitle>
                            <CardDescription>{userReport.user.username} • {userReport.user.email}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {userReport.hasFullAccess && <Badge className="bg-purple-500">مدير</Badge>}
                          {userReport.hasMultiBranchAccess && <Badge className="bg-blue-500">متعدد الفروع</Badge>}
                          <Badge variant={userReport.user.isActive === 'active' ? 'default' : 'secondary'}>
                            {userReport.user.isActive === 'active' ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-medium mb-2">الفروع المتاحة:</h4>
                          <div className="flex flex-wrap gap-1">
                            {userReport.hasFullAccess ? (
                              <Badge variant="outline">جميع الفروع</Badge>
                            ) : userReport.branchAccess.length > 0 ? (
                              userReport.branchAccess.map((b, i) => (
                                <Badge key={i} variant="outline" className={b.isDefault ? 'border-primary' : ''}>
                                  {b.branchName}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">لا توجد فروع محددة</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">الصلاحيات ({userReport.permissionsCount}):</h4>
                          <div className="flex flex-wrap gap-1">
                            {userReport.hasFullAccess ? (
                              <Badge variant="outline" className="border-purple-500">صلاحيات كاملة</Badge>
                            ) : userReport.modulesWithAccess.length > 0 ? (
                              userReport.modulesWithAccess.slice(0, 5).map((m, i) => (
                                <Badge key={i} variant="outline">{m}</Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-sm">لا توجد صلاحيات</span>
                            )}
                            {userReport.modulesWithAccess.length > 5 && (
                              <Badge variant="outline">+{userReport.modulesWithAccess.length - 5}</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                تنبيهات المحاولات غير المصرح بها
              </CardTitle>
              <CardDescription>
                مراقبة المحاولات المرفوضة والأنشطة المشبوهة
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alerts?.summary && (
                <div className="grid grid-cols-5 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold">{alerts.summary.total}</div>
                      <div className="text-sm text-muted-foreground">الإجمالي</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-red-600">{alerts.summary.bySeverity.critical}</div>
                      <div className="text-sm text-muted-foreground">حرج</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-orange-50">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">{alerts.summary.bySeverity.high}</div>
                      <div className="text-sm text-muted-foreground">عالي</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-yellow-50">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">{alerts.summary.bySeverity.medium}</div>
                      <div className="text-sm text-muted-foreground">متوسط</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50">
                    <CardContent className="pt-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{alerts.summary.bySeverity.low}</div>
                      <div className="text-sm text-muted-foreground">منخفض</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الخطورة</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>التفاصيل</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alertsLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell>
                    </TableRow>
                  ) : alerts?.alerts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        لا توجد تنبيهات أمنية
                      </TableCell>
                    </TableRow>
                  ) : alerts?.alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                      <TableCell>{getAlertTypeLabel(alert.alertType)}</TableCell>
                      <TableCell>{alert.userName || 'غير معروف'}</TableCell>
                      <TableCell>{alert.module || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">{alert.details || '-'}</TableCell>
                      <TableCell dir="ltr" className="text-left">
                        {new Date(alert.createdAt).toLocaleString('en-GB')}
                      </TableCell>
                      <TableCell>
                        {alert.isResolved ? (
                          <Badge variant="outline" className="text-green-600">
                            <CheckCircle className="h-3 w-3 ml-1" />
                            تم الحل
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-orange-600">
                            <Clock className="h-3 w-3 ml-1" />
                            معلق
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                سجل التدقيق المُعزز
              </CardTitle>
              <CardDescription>
                تتبع جميع العمليات والتغييرات في النظام
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="جميع الوحدات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الوحدات</SelectItem>
                    {auditLog?.filters.modules.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>الوحدة</TableHead>
                    <TableHead>العملية</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>العنصر</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8">جاري التحميل...</TableCell>
                    </TableRow>
                  ) : auditLog?.logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell dir="ltr" className="text-left whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('en-GB')}
                      </TableCell>
                      <TableCell>{log.userName || 'غير معروف'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.moduleLabel}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{log.actionLabel}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{log.description || '-'}</TableCell>
                      <TableCell>{log.entityName || '-'}</TableCell>
                      <TableCell dir="ltr" className="text-left">{log.ipAddress || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {auditLog?.pagination && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    صفحة {auditLog.pagination.page} من {auditLog.pagination.totalPages} 
                    (إجمالي {auditLog.pagination.total.toLocaleString('en-US')} سجل)
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage(p => p - 1)}
                    >
                      السابق
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={auditPage >= auditLog.pagination.totalPages}
                      onClick={() => setAuditPage(p => p + 1)}
                    >
                      التالي
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
