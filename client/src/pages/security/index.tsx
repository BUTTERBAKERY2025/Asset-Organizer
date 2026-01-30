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
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2" data-testid="tab-overview">
            <Activity className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">نظرة عامة</span>
            <span className="xs:hidden">عام</span>
          </TabsTrigger>
          <TabsTrigger value="permissions" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2" data-testid="tab-permissions">
            <Users className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">صلاحيات المستخدمين</span>
            <span className="sm:hidden">الصلاحيات</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2" data-testid="tab-alerts">
            <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden xs:inline">التنبيهات</span>
            <span className="xs:hidden">تنبيه</span>
            {stats?.overview.pendingAlerts ? (
              <Badge variant="destructive" className="mr-1 text-[10px] px-1" data-testid="badge-pending-alerts">{stats.overview.pendingAlerts}</Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm py-2" data-testid="tab-audit">
            <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">سجل التدقيق</span>
            <span className="sm:hidden">السجل</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 sm:space-y-6" data-testid="content-overview">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-4">
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">أكثر المستخدمين نشاطاً (آخر 7 أيام)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">المستخدم</TableHead>
                      <TableHead className="text-xs sm:text-sm">عدد العمليات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.activeUsers.slice(0, 5).map((u, i) => (
                      <TableRow key={i} data-testid={`row-active-user-${i}`}>
                        <TableCell className="text-xs sm:text-sm">{u.userName}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{u.actionsCount.toLocaleString('en-US')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 sm:pb-4">
                <CardTitle className="text-sm sm:text-base">العمليات حسب الوحدة (آخر 7 أيام)</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">الوحدة</TableHead>
                      <TableHead className="text-xs sm:text-sm">عدد العمليات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats?.actionsByModule.slice(0, 5).map((m, i) => (
                      <TableRow key={i} data-testid={`row-module-${i}`}>
                        <TableCell className="text-xs sm:text-sm">{m.moduleLabel}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{m.count.toLocaleString('en-US')}</TableCell>
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
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg">تقرير صلاحيات المستخدمين</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                عرض تفصيلي لصلاحيات كل مستخدم والفروع المتاحة له
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
                <Card className="bg-blue-50" data-testid="card-total-users">
                  <CardContent className="p-3 sm:pt-4">
                    <div className="text-center">
                      <div className="text-lg sm:text-2xl font-bold text-blue-600">
                        {permissionsReport?.summary.totalUsers?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">إجمالي المستخدمين</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-green-50" data-testid="card-active-users">
                  <CardContent className="p-3 sm:pt-4">
                    <div className="text-center">
                      <div className="text-lg sm:text-2xl font-bold text-green-600">
                        {permissionsReport?.summary.activeUsers?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">مستخدمين نشطين</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-purple-50" data-testid="card-admin-users">
                  <CardContent className="p-3 sm:pt-4">
                    <div className="text-center">
                      <div className="text-lg sm:text-2xl font-bold text-purple-600">
                        {permissionsReport?.summary.adminUsers?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">مديرين</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50" data-testid="card-multi-branch">
                  <CardContent className="p-3 sm:pt-4">
                    <div className="text-center">
                      <div className="text-lg sm:text-2xl font-bold text-orange-600">
                        {permissionsReport?.summary.multiBranchUsers?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">متعدد الفروع</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-red-50 col-span-2 sm:col-span-1" data-testid="card-no-permissions">
                  <CardContent className="p-3 sm:pt-4">
                    <div className="text-center">
                      <div className="text-lg sm:text-2xl font-bold text-red-600">
                        {permissionsReport?.summary.usersWithNoPermissions?.toLocaleString('en-US') || 0}
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground">بدون صلاحيات</div>
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

              <div className="space-y-3 sm:space-y-4">
                {permissionsLoading ? (
                  <div className="text-center py-8 text-sm">جاري التحميل...</div>
                ) : filteredUsers.map((userReport) => (
                  <Card key={userReport.user.id} className="border" data-testid={`card-user-${userReport.user.id}`}>
                    <CardHeader className="p-3 sm:pb-2 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
                          </div>
                          <div className="min-w-0">
                            <CardTitle className="text-sm sm:text-base truncate">{userReport.user.fullName}</CardTitle>
                            <CardDescription className="text-xs sm:text-sm truncate">{userReport.user.username}</CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-wrap">
                          {userReport.hasFullAccess && <Badge className="bg-purple-500 text-[10px] sm:text-xs">مدير</Badge>}
                          {userReport.hasMultiBranchAccess && <Badge className="bg-blue-500 text-[10px] sm:text-xs hidden sm:inline-flex">متعدد الفروع</Badge>}
                          <Badge variant={userReport.user.isActive === 'active' ? 'default' : 'secondary'} className="text-[10px] sm:text-xs">
                            {userReport.user.isActive === 'active' ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div>
                          <h4 className="font-medium mb-1 sm:mb-2 text-xs sm:text-sm">الفروع المتاحة:</h4>
                          <div className="flex flex-wrap gap-1">
                            {userReport.hasFullAccess ? (
                              <Badge variant="outline" className="text-[10px] sm:text-xs">جميع الفروع</Badge>
                            ) : userReport.branchAccess.length > 0 ? (
                              userReport.branchAccess.slice(0, 3).map((b, i) => (
                                <Badge key={i} variant="outline" className={`text-[10px] sm:text-xs ${b.isDefault ? 'border-primary' : ''}`}>
                                  {b.branchName}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">لا توجد فروع</span>
                            )}
                            {userReport.branchAccess.length > 3 && (
                              <Badge variant="outline" className="text-[10px] sm:text-xs">+{userReport.branchAccess.length - 3}</Badge>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="font-medium mb-1 sm:mb-2 text-xs sm:text-sm">الصلاحيات ({userReport.permissionsCount}):</h4>
                          <div className="flex flex-wrap gap-1">
                            {userReport.hasFullAccess ? (
                              <Badge variant="outline" className="border-purple-500 text-[10px] sm:text-xs">صلاحيات كاملة</Badge>
                            ) : userReport.modulesWithAccess.length > 0 ? (
                              userReport.modulesWithAccess.slice(0, 3).map((m, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] sm:text-xs">{m}</Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground text-xs">لا توجد صلاحيات</span>
                            )}
                            {userReport.modulesWithAccess.length > 3 && (
                              <Badge variant="outline" className="text-[10px] sm:text-xs">+{userReport.modulesWithAccess.length - 3}</Badge>
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

        <TabsContent value="alerts" className="space-y-4" data-testid="content-alerts">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                تنبيهات المحاولات غير المصرح بها
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                مراقبة المحاولات المرفوضة والأنشطة المشبوهة
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              {alerts?.summary && (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4 mb-4 sm:mb-6">
                  <Card data-testid="stat-alerts-total">
                    <CardContent className="p-3 sm:pt-4 text-center">
                      <div className="text-lg sm:text-2xl font-bold">{alerts.summary.total}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">الإجمالي</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-red-50" data-testid="stat-alerts-critical">
                    <CardContent className="p-3 sm:pt-4 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-red-600">{alerts.summary.bySeverity.critical}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">حرج</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-orange-50" data-testid="stat-alerts-high">
                    <CardContent className="p-3 sm:pt-4 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-orange-600">{alerts.summary.bySeverity.high}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">عالي</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-yellow-50 hidden sm:block" data-testid="stat-alerts-medium">
                    <CardContent className="p-3 sm:pt-4 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-yellow-600">{alerts.summary.bySeverity.medium}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">متوسط</div>
                    </CardContent>
                  </Card>
                  <Card className="bg-blue-50 hidden sm:block" data-testid="stat-alerts-low">
                    <CardContent className="p-3 sm:pt-4 text-center">
                      <div className="text-lg sm:text-2xl font-bold text-blue-600">{alerts.summary.bySeverity.low}</div>
                      <div className="text-xs sm:text-sm text-muted-foreground">منخفض</div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <Table className="min-w-[600px] sm:min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">الخطورة</TableHead>
                      <TableHead className="text-xs sm:text-sm">النوع</TableHead>
                      <TableHead className="text-xs sm:text-sm">المستخدم</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">الوحدة</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden lg:table-cell">التفاصيل</TableHead>
                      <TableHead className="text-xs sm:text-sm">التاريخ</TableHead>
                      <TableHead className="text-xs sm:text-sm">الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alertsLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-sm">جاري التحميل...</TableCell>
                      </TableRow>
                    ) : alerts?.alerts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                          لا توجد تنبيهات أمنية
                        </TableCell>
                      </TableRow>
                    ) : alerts?.alerts.map((alert) => (
                      <TableRow key={alert.id} data-testid={`row-alert-${alert.id}`}>
                        <TableCell className="text-xs sm:text-sm">{getSeverityBadge(alert.severity)}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{getAlertTypeLabel(alert.alertType)}</TableCell>
                        <TableCell className="text-xs sm:text-sm">{alert.userName || 'غير معروف'}</TableCell>
                        <TableCell className="text-xs sm:text-sm hidden md:table-cell">{alert.module || '-'}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs sm:text-sm hidden lg:table-cell">{alert.details || '-'}</TableCell>
                        <TableCell dir="ltr" className="text-left text-xs sm:text-sm whitespace-nowrap">
                          {new Date(alert.createdAt).toLocaleString('en-GB')}
                        </TableCell>
                        <TableCell>
                          {alert.isResolved ? (
                            <Badge variant="outline" className="text-green-600 text-[10px] sm:text-xs">
                              <CheckCircle className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1" />
                              <span className="hidden sm:inline">تم الحل</span>
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 text-[10px] sm:text-xs">
                              <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 ml-1" />
                              <span className="hidden sm:inline">معلق</span>
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4" data-testid="content-audit">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                سجل التدقيق المُعزز
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                تتبع جميع العمليات والتغييرات في النظام
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <div className="flex gap-2 sm:gap-4 mb-4">
                <Select value={moduleFilter} onValueChange={setModuleFilter}>
                  <SelectTrigger className="w-full sm:w-48 text-xs sm:text-sm" data-testid="select-module-filter">
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

              <div className="overflow-x-auto -mx-3 sm:mx-0">
                <Table className="min-w-[700px] sm:min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">التاريخ</TableHead>
                      <TableHead className="text-xs sm:text-sm">المستخدم</TableHead>
                      <TableHead className="text-xs sm:text-sm">الوحدة</TableHead>
                      <TableHead className="text-xs sm:text-sm">العملية</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden md:table-cell">الوصف</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden lg:table-cell">العنصر</TableHead>
                      <TableHead className="text-xs sm:text-sm hidden lg:table-cell">IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLoading ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-sm">جاري التحميل...</TableCell>
                      </TableRow>
                    ) : auditLog?.logs.map((log) => (
                      <TableRow key={log.id} data-testid={`row-audit-${log.id}`}>
                        <TableCell dir="ltr" className="text-left whitespace-nowrap text-xs sm:text-sm">
                          {new Date(log.createdAt).toLocaleString('en-GB')}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm">{log.userName || 'غير معروف'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] sm:text-xs">{log.moduleLabel}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px] sm:text-xs">{log.actionLabel}</Badge>
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs sm:text-sm hidden md:table-cell">{log.description || '-'}</TableCell>
                        <TableCell className="text-xs sm:text-sm hidden lg:table-cell">{log.entityName || '-'}</TableCell>
                        <TableCell dir="ltr" className="text-left text-xs sm:text-sm hidden lg:table-cell">{log.ipAddress || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {auditLog?.pagination && (
                <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-2">
                  <div className="text-xs sm:text-sm text-muted-foreground">
                    صفحة {auditLog.pagination.page} من {auditLog.pagination.totalPages} 
                    (إجمالي {auditLog.pagination.total.toLocaleString('en-US')} سجل)
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs sm:text-sm"
                      disabled={auditPage <= 1}
                      onClick={() => setAuditPage(p => p - 1)}
                      data-testid="button-audit-prev"
                    >
                      السابق
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="text-xs sm:text-sm"
                      disabled={auditPage >= auditLog.pagination.totalPages}
                      onClick={() => setAuditPage(p => p + 1)}
                      data-testid="button-audit-next"
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
